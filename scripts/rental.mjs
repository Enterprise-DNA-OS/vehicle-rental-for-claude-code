#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { table } from './lib/format.mjs';
import { parseCsv, pick } from './lib/csv.mjs';

export const reads = {
 fleet:'SELECT plate,model,category,location,status,odometer,service_km,inspection_expires,blockers FROM fleet_readiness ORDER BY plate',
 board:'SELECT ref,plate,driver,status,pickup_at,return_due,currency,balance_cents FROM rental_board ORDER BY pickup_at',
 pickups:"SELECT ref,plate,driver,pickup_at,pickup_location FROM rental_board WHERE status='reserved' AND pickup_at<now()+interval '7 days' ORDER BY pickup_at",
 returns:"SELECT ref,plate,driver,return_due,return_location,hours_overdue FROM rental_board WHERE status='out' ORDER BY return_due",
 attention:'SELECT * FROM attention_queue ORDER BY issue,ref',
 compliance:'SELECT ref,rule,finding FROM compliance_findings ORDER BY ref,rule',
 'service-due':"SELECT plate,odometer,service_km,service_due,inspection_expires,registration_expires,blockers FROM fleet_readiness WHERE blockers<>'' OR service_due<=current_date+14 OR inspection_expires<=current_date+14 ORDER BY plate",
 damage:'SELECT d.id,b.ref,d.description,d.estimated_cents,d.decision,d.evidence_ref FROM damage d JOIN bookings b ON b.id=d.booking_id ORDER BY d.created_at',
 infringements:'SELECT i.id,b.ref,i.notice_ref,i.authority,i.occurred_at,i.due_date,i.status FROM infringements i JOIN bookings b ON b.id=i.booking_id ORDER BY i.due_date',
 balances:"SELECT ref,driver,status,currency,total_cents,paid_cents,balance_cents FROM rental_board WHERE status!='cancelled' AND balance_cents<>0 ORDER BY balance_cents DESC",
 utilisation:"SELECT v.plate,v.category,count(b.id)::int AS hires_30_days,coalesce(round(sum(extract(epoch FROM (least(coalesce(b.returned_at,now()),now())-greatest(b.checkout_at,now()-interval '30 days'))))/86400,2),0) AS days_out_30 FROM vehicles v LEFT JOIN bookings b ON b.vehicle_id=v.id AND b.status IN ('out','returned') AND b.checkout_at<now() AND coalesce(b.returned_at,now())>now()-interval '30 days' GROUP BY v.id ORDER BY days_out_30 DESC,v.plate",
 'rate-review':"SELECT v.plate,v.daily_cents AS current_rate_cents,b.ref,b.rate_cents AS booked_rate_cents,b.currency FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id WHERE b.status='reserved' AND b.rate_cents<>v.daily_cents ORDER BY b.ref",
 'quiet-bookings':"SELECT b.ref,d.name,b.pickup_at,max(n.created_at) AS last_note FROM bookings b JOIN drivers d ON d.id=b.driver_id LEFT JOIN notes n ON n.booking_id=b.id WHERE b.status IN ('reserved','out') GROUP BY b.id,d.name HAVING max(n.created_at)<now()-interval '3 days' OR max(n.created_at) IS NULL ORDER BY b.pickup_at",
 drivers:'SELECT id,name,email,licence_expires,class_verified FROM drivers ORDER BY name',
};
const tables=['vehicles','drivers','bookings','booking_drivers','damage','infringements','services','notes'];
const f=(args,key,def=null)=>{const a=args.find(x=>x.startsWith(`--${key}=`));return a?a.slice(key.length+3):def;};
const need=(v,label)=>{if(v===null||v===undefined||String(v).trim()==='')throw Error(`Required: ${label}`);return String(v).trim();};
const integer=(v,label)=>{if(!/^\d+$/.test(need(v,label)))throw Error(`${label} must be a nonnegative integer`); const n=Number(v);if(!Number.isSafeInteger(n)||n>2147483647)throw Error(`${label} out of range`);return n;};
const stamp=v=>{need(v,'ISO timestamp with timezone');if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('Use ISO timestamps with an explicit timezone');return new Date(v).toISOString();};
export async function resolve(db,t,q,column){
 need(q,`${t} reference`);if(!tables.includes(t))throw Error('Unknown record type');
 const rows=await db.query(`SELECT * FROM ${t} WHERE id::text ILIKE $1 OR ${column} ILIKE $2 ORDER BY ${column}`,[q+'%',q]);
 const matches=rows.length?rows:await db.query(`SELECT * FROM ${t} WHERE ${column} ILIKE $1 ORDER BY ${column}`,['%'+q+'%']);
 if(matches.length!==1)throw Error(`${matches.length?'Ambiguous':'Not found'} ${t}: ${q}\n`+matches.map(r=>`${r.id} ${r[column]}`).join('\n'));
 return matches[0];
}
async function tx(db,fn){await db.exec('BEGIN');try{const r=await fn();await db.exec('COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}
async function insert(db,t,obj){const cols=Object.keys(obj);return (await db.query(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(obj)))[0];}
const booking=(db,q)=>resolve(db,'bookings',q,'ref');
const vehicle=(db,q)=>resolve(db,'vehicles',q,'plate');
const driver=(db,q)=>resolve(db,'drivers',q,'name');
async function assertReady(db,b){const issues=await db.query('SELECT rule,finding FROM compliance_findings WHERE id=$1',[b.id]);if(issues.length)throw Error(issues.map(i=>`${i.rule}: ${i.finding}`).join('\n'));}
export async function run(db,args){
 const [cmd='help',ref,...rest]=args.filter(a=>!a.startsWith('--'));
 const opt=(key,def=null)=>f(args,key,def);
 if(cmd==='help')return [{commands:[...Object.keys(reads),'availability','booking','book','add driver','add vehicle','add-driver','verify-driver','agreement','precheck','pickup','return','ready','service','certify','extend','cancel','damage-add','damage-decide','notice-add','notice-status','log','record-paid','draft-return','import rental-car-manager','export'].join(', ')}];
 if(reads[cmd])return db.query(reads[cmd]);
 if(cmd==='availability'){
  const start=stamp(need(opt('from'),'--from')),end=stamp(need(opt('to'),'--to'));if(end<=start)throw Error('End must follow start');
  return db.query(`SELECT v.plate,v.model,v.category,v.location,v.daily_cents,v.currency FROM fleet_readiness v WHERE v.blockers='' AND v.inspection_expires>=$2::timestamptz::date AND v.registration_expires>=$2::timestamptz::date AND ($3::text IS NULL OR v.location ILIKE $3) AND NOT EXISTS(SELECT 1 FROM bookings b WHERE b.vehicle_id=v.id AND (b.status='out' OR (b.status='reserved' AND b.pickup_at<$2 AND b.return_due>$1))) ORDER BY plate`,[start,end,opt('location')]);
 }
 if(cmd==='booking'){const b=await booking(db,ref);return {booking:(await db.query('SELECT * FROM rental_board WHERE id=$1',[b.id]))[0],record:b,drivers:await db.query('SELECT d.name,d.licence_expires FROM booking_drivers bd JOIN drivers d ON d.id=bd.driver_id WHERE bd.booking_id=$1',[b.id]),damage:await db.query('SELECT * FROM damage WHERE booking_id=$1',[b.id]),notes:await db.query('SELECT body,created_at FROM notes WHERE booking_id=$1 ORDER BY created_at',[b.id])};}
 if(cmd==='add'){
  if(ref==='driver')return [await insert(db,'drivers',{name:need(opt('name'),'--name'),external_id:opt('external-id'),email:opt('email'),address:opt('address'),phone:opt('phone'),dob:opt('dob')})];
  if(ref==='vehicle')return [await insert(db,'vehicles',{plate:need(opt('plate'),'--plate').toUpperCase(),model:need(opt('model'),'--model'),category:need(opt('category'),'--category'),location:need(opt('location'),'--location'),daily_cents:integer(opt('daily-cents'),'--daily-cents'),odometer:integer(opt('km','0'),'--km'),service_km:integer(opt('service-km'),'--service-km'),currency:opt('currency','NZD'),jurisdiction:opt('jurisdiction','NZ')})];
  throw Error('Use add driver or add vehicle');
 }
 if(cmd==='book')return tx(db,async()=>{
  const v=await vehicle(db,need(opt('vehicle'),'--vehicle')),d=await driver(db,need(opt('driver'),'--driver'));
  await db.query('SELECT id FROM vehicles WHERE id=$1 FOR UPDATE',[v.id]);
  if(v.status==='retired')throw Error('Vehicle is retired');
  return [await insert(db,'bookings',{ref:need(ref,'booking ref'),vehicle_id:v.id,driver_id:d.id,pickup_at:stamp(opt('from')),return_due:stamp(opt('to')),pickup_location:opt('pickup-location',v.location),return_location:opt('return-location',v.location),rate_cents:integer(opt('rate-cents',String(v.daily_cents)),'--rate-cents'),currency:v.currency,excess_cents:integer(opt('excess-cents','0'),'--excess-cents')})];
 });
 if(cmd==='verify-driver'){
  const d=await driver(db,ref);if(opt('class-verified')!=='yes')throw Error('Confirm vehicle class suitability with --class-verified=yes after checking the actual licence');
  return db.query('UPDATE drivers SET licence_number=$2,licence_jurisdiction=$3,licence_expires=$4,licence_checked_at=now(),class_verified=true WHERE id=$1 RETURNING id,name,licence_expires',[d.id,need(opt('number'),'--number'),need(opt('jurisdiction'),'--jurisdiction'),need(opt('expires'),'--expires')]);
 }
 if(['ready','service','certify'].includes(cmd))return tx(db,async()=>{
  const v=await vehicle(db,ref);await db.query('SELECT id FROM vehicles WHERE id=$1 FOR UPDATE',[v.id]);
  if(cmd==='ready'){
   if((await db.query("SELECT id FROM bookings WHERE vehicle_id=$1 AND status='out'",[v.id])).length)throw Error('Vehicle is still out');
   if(opt('checked')!=='yes')throw Error('Confirm cleaning and condition with --checked=yes');
   return db.query("UPDATE vehicles SET status='ready' WHERE id=$1 RETURNING plate,status",[v.id]);
  }
  if(cmd==='certify')return db.query('UPDATE vehicles SET inspection_expires=$2,registration_expires=$3 WHERE id=$1 RETURNING plate,inspection_expires,registration_expires',[v.id,need(opt('inspection'),'--inspection'),need(opt('registration'),'--registration')]);
  const km=integer(opt('km'),'--km'),next=integer(opt('next-km'),'--next-km');if(km<v.odometer||next<=km)throw Error('Odometer cannot decrease and next service must be later');
  await insert(db,'services',{vehicle_id:v.id,description:need(opt('note'),'--note'),odometer:km,cost_cents:integer(opt('cost-cents','0'),'--cost-cents')});
  return db.query('UPDATE vehicles SET odometer=$2,service_km=$3,service_due=$4 WHERE id=$1 RETURNING plate,odometer,service_km,service_due',[v.id,km,next,need(opt('due'),'--due')]);
 });
 if(cmd==='import')return importRcm(db,ref,rest[0],args.includes('--dry-run'));
 if(cmd==='export'){
  const out={format:'vehicle-rental-v1',exported_at:new Date().toISOString(),records:{}};
  await tx(db,async()=>{await db.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');for(const t of tables)out.records[t]=await db.query(`SELECT * FROM ${t} ORDER BY id`);});
  const file=path.resolve(opt('file',path.join(REPO_ROOT,'exports',`rental-${Date.now()}.json`)));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n',{flag:'wx'});return [{file,records:Object.values(out.records).reduce((n,a)=>n+a.length,0)}];
 }
 const allowed=['add-driver','agreement','precheck','pickup','return','extend','cancel','damage-add','damage-decide','notice-add','notice-status','log','record-paid','draft-return'];
 if(!allowed.includes(cmd))throw Error(`Unknown command ${cmd}; use help`);
 return tx(db,async()=>{
  const b=await booking(db,ref);await db.query('SELECT id FROM vehicles WHERE id=$1 FOR UPDATE',[b.vehicle_id]);await db.query('SELECT id FROM bookings WHERE id=$1 FOR UPDATE',[b.id]);
  const fresh=(await db.query('SELECT * FROM bookings WHERE id=$1',[b.id]))[0];Object.assign(b,fresh);
  if(cmd==='log')return [await insert(db,'notes',{booking_id:b.id,body:need(opt('note'),'--note')})];
  if(cmd==='add-driver'){const d=await driver(db,need(opt('driver'),'--driver'));if(!['reserved'].includes(b.status))throw Error('Add drivers before departure');return [await insert(db,'booking_drivers',{booking_id:b.id,driver_id:d.id})];}
  if(cmd==='agreement'){
   if(b.status!=='reserved')throw Error('Record agreement before departure');
   for(const k of ['copy-given','insurance-offered','terms-reviewed'])if(opt(k)!=='yes')throw Error(`Confirm --${k}=yes from actual evidence`);
   return db.query('UPDATE bookings SET agreement_ref=$2,agreement_given_at=now(),insurance_offered_at=now(),terms_reviewed=true WHERE id=$1 RETURNING ref,agreement_ref',[b.id,need(opt('reference'),'--reference')]);
  }
  if(cmd==='precheck'){
   if(b.status!=='reserved')throw Error('Check reserved bookings before departure');
   const v=(await db.query('SELECT * FROM vehicles WHERE id=$1',[b.vehicle_id]))[0],km=integer(opt('km'),'--km');if(km<v.odometer)throw Error('Odometer cannot decrease');
   await db.query('UPDATE vehicles SET odometer=$2 WHERE id=$1',[v.id,km]);
   await insert(db,'notes',{booking_id:b.id,body:'Precheck: '+need(opt('note'),'--note')});
   return db.query('UPDATE bookings SET precheck_at=now(),km_out=$2,fuel_out=$3 WHERE id=$1 RETURNING ref,km_out,fuel_out',[b.id,km,need(opt('fuel'),'--fuel')]);
  }
  if(cmd==='pickup'){
   if(b.status!=='reserved')throw Error('Pickup requires a reserved booking');
   if(new Date(b.pickup_at)>new Date()||new Date(b.return_due)<=new Date())throw Error('Pickup must be inside the agreed hire interval');
   await assertReady(db,b);
   if((await db.query("SELECT id FROM bookings WHERE vehicle_id=$1 AND status='out' AND id<>$2",[b.vehicle_id,b.id])).length)throw Error('Vehicle has not returned');
   const v=(await db.query('SELECT location FROM vehicles WHERE id=$1',[b.vehicle_id]))[0];if(v.location!==b.pickup_location)throw Error('Vehicle is at a different location');
   return db.query("UPDATE bookings SET status='out',checkout_at=now() WHERE id=$1 RETURNING ref,status",[b.id]);
  }
  if(cmd==='return'){
   if(b.status!=='out')throw Error('Return requires a vehicle currently out');
   const km=integer(opt('km'),'--km'),v=(await db.query('SELECT odometer FROM vehicles WHERE id=$1',[b.vehicle_id]))[0];if(km<Math.max(b.km_out||0,v.odometer))throw Error('Odometer cannot decrease');
   await db.query("UPDATE vehicles SET odometer=$2,status='cleaning',location=$3 WHERE id=$1",[b.vehicle_id,km,opt('location',b.return_location)]);
   await insert(db,'notes',{booking_id:b.id,body:'Return check: '+need(opt('note'),'--note')});
   return db.query("UPDATE bookings SET status='returned',returned_at=now(),km_in=$2,fuel_in=$3 WHERE id=$1 RETURNING ref,status,km_in",[b.id,km,need(opt('fuel'),'--fuel')]);
  }
  if(cmd==='extend'){
   if(!['reserved','out'].includes(b.status))throw Error('Only open bookings can change');
   const end=stamp(opt('to'));if(new Date(end)<=new Date(b.return_due))throw Error('Extension must increase return date');
   await db.query('UPDATE bookings SET return_due=$2 WHERE id=$1',[b.id,end]);await assertReady(db,{...b,return_due:end});return [{ref:b.ref,return_due:end}];
  }
  if(cmd==='cancel'){if(b.status!=='reserved')throw Error('Cancel only reserved bookings');return db.query("UPDATE bookings SET status='cancelled' WHERE id=$1 RETURNING ref,status",[b.id]);}
  if(cmd==='damage-add')return [await insert(db,'damage',{booking_id:b.id,description:need(opt('note'),'--note'),estimated_cents:integer(opt('cents','0'),'--cents'),evidence_ref:need(opt('evidence'),'--evidence')})];
  if(cmd==='damage-decide'){
   const d=await resolve(db,'damage',need(opt('damage'),'--damage'),'description');if(d.booking_id!==b.id)throw Error('Damage belongs to another booking');
   const decision=opt('decision');if(!['charge','waive'].includes(decision))throw Error('Decision must be charge or waive');
   if(d.decision!=='open')throw Error('Damage decision already recorded');
   return db.query('UPDATE damage SET decision=$2,decision_note=$3 WHERE id=$1 RETURNING id,decision',[d.id,decision,need(opt('note'),'--note')]);
  }
  if(cmd==='notice-add'){
   const at=stamp(opt('at'));if(!b.checkout_at||new Date(at)<new Date(b.checkout_at)||new Date(at)>new Date(b.returned_at||b.return_due))throw Error('Incident is outside recorded custody. Investigate before linking.');
   return [await insert(db,'infringements',{booking_id:b.id,notice_ref:need(opt('notice'),'--notice'),occurred_at:at,authority:need(opt('authority'),'--authority'),due_date:need(opt('due'),'--due')})];
  }
  if(cmd==='notice-status'){
   const n=await resolve(db,'infringements',need(opt('notice'),'--notice'),'notice_ref');if(n.booking_id!==b.id)throw Error('Notice belongs to another booking');
   if(!['nominated','disputed','closed'].includes(opt('status')))throw Error('Use nominated, disputed or closed');
   return db.query('UPDATE infringements SET status=$2,evidence_ref=$3 WHERE id=$1 RETURNING notice_ref,status',[n.id,opt('status'),need(opt('evidence'),'--evidence')]);
  }
  if(cmd==='record-paid'){
   await insert(db,'notes',{booking_id:b.id,body:'Payment total reconciled: '+need(opt('reference'),'--reference')});
   return db.query('UPDATE bookings SET paid_cents=$2 WHERE id=$1 RETURNING ref,paid_cents',[b.id,integer(opt('total-cents'),'--total-cents')]);
  }
  const row=(await db.query('SELECT * FROM rental_board WHERE id=$1',[b.id]))[0];
  const dir=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,`${b.id}-return.md`);
  fs.writeFileSync(file,`# Return follow-up draft\n\nHello ${row.driver},\n\nYour booking ${b.ref} for ${row.plate} has an agreed return of ${new Date(b.return_due).toISOString()} at ${b.return_location}. Please contact us to confirm your return arrangements.\n\nDraft only. Review before sending.\n`);return [{file}];
 });
}
async function importRcm(db,vendor,file,dry){
 if(vendor!=='rental-car-manager')throw Error('Use import rental-car-manager <bookings.csv>');
 const rows=parseCsv(fs.readFileSync(need(file,'CSV file'),'utf8'));if(!rows.length)throw Error('No CSV records');
 const mapped=rows.map((r,i)=>{
  try{return {ref:need(pick(r,'Booking No','Reservation Number','ResNo','ref'),'Booking No'),plate:need(pick(r,'Registration','Rego','Vehicle Registration','plate'),'Registration'),customer:need(pick(r,'Customer ID','CustomerID','driver_external_id'),'Customer ID'),name:need(pick(r,'Customer Name','Name','driver'),'Customer Name'),from:stamp(pick(r,'Pickup Date Time','PickupDate','pickup_at')),to:stamp(pick(r,'Dropoff Date Time','DropOffDate','return_due')),pickup:need(pick(r,'Pickup Location','pickup_location'),'Pickup Location'),dropoff:need(pick(r,'Dropoff Location','return_location'),'Dropoff Location'),rate:integer(pick(r,'Daily Rate Cents','rate_cents'),'Daily Rate Cents'),currency:need(pick(r,'Currency','currency'),'Currency'),email:pick(r,'Email','email')||null,model:pick(r,'Model','model'),category:pick(r,'Category','category'),jurisdiction:pick(r,'Jurisdiction','jurisdiction')||'NZ',status:(pick(r,'Status','status')||'reserved').toLowerCase(),checkout:pick(r,'Checkout At','checkout_at'),returned:pick(r,'Returned At','returned_at'),paid:integer(pick(r,'Paid Cents','paid_cents')||'0','Paid Cents'),extras:integer(pick(r,'Extras Cents','extras_cents')||'0','Extras Cents')};}catch(e){throw Error(`CSV row ${i+2}: ${e.message}`);}
 });
 if(new Set(mapped.map(r=>r.ref)).size!==mapped.length)throw Error('Duplicate Booking No in CSV');
 await db.exec('BEGIN');let inserted=0,unchanged=0;
 try{
  for(const r of mapped){
   if(!['reserved','out','returned','cancelled'].includes(r.status))throw Error(`Unsupported Status for ${r.ref}: map to reserved/out/returned/cancelled`);
   const checkout=r.checkout?stamp(r.checkout):null,returned=r.returned?stamp(r.returned):null;
   if(['out','returned'].includes(r.status)&&!checkout)throw Error(`Checkout At required for ${r.ref}`);
   if(r.status==='returned'&&!returned)throw Error(`Returned At required for ${r.ref}`);
   if(returned&&(!checkout||returned<checkout||returned<r.from))throw Error(`Invalid return chronology for ${r.ref}`);
   let v=(await db.query('SELECT * FROM vehicles WHERE lower(plate)=lower($1)',[r.plate]))[0];
   if(!v)v=await insert(db,'vehicles',{plate:r.plate.toUpperCase(),model:need(r.model,'Model for a new vehicle'),category:need(r.category,'Category for a new vehicle'),location:r.pickup,daily_cents:r.rate,service_km:1,status:'workshop',currency:r.currency,jurisdiction:r.jurisdiction});
   if(v.currency!==r.currency)throw Error(`Currency mismatch for ${r.ref}`);
   const existing=(await db.query('SELECT * FROM bookings WHERE ref=$1',[r.ref]))[0];
   const oldDriver=(await db.query('SELECT * FROM drivers WHERE external_id=$1',[r.customer]))[0];
   if(existing){
    if(existing.vehicle_id!==v.id||existing.driver_id!==oldDriver?.id||new Date(existing.pickup_at).toISOString()!==r.from||new Date(existing.return_due).toISOString()!==r.to||existing.rate_cents!==r.rate||existing.pickup_location!==r.pickup||existing.return_location!==r.dropoff||existing.status!==r.status||existing.paid_cents!==r.paid||existing.extras_cents!==r.extras||(existing.checkout_at?new Date(existing.checkout_at).toISOString():null)!==checkout||(existing.returned_at?new Date(existing.returned_at).toISOString():null)!==returned)throw Error(`Changed existing booking ${r.ref}; reconcile it explicitly before reimporting`);
    unchanged++;continue;
   }
   const d=oldDriver||await insert(db,'drivers',{external_id:r.customer,name:r.name,email:r.email});
   await insert(db,'bookings',{ref:r.ref,vehicle_id:v.id,driver_id:d.id,pickup_at:r.from,return_due:r.to,pickup_location:r.pickup,return_location:r.dropoff,rate_cents:r.rate,currency:r.currency,status:r.status,checkout_at:checkout,returned_at:returned,paid_cents:r.paid,extras_cents:r.extras});inserted++;
  }
  await db.exec(dry?'ROLLBACK':'COMMIT');
 }catch(e){await db.exec('ROLLBACK');throw e;}
 return [{rows:rows.length,inserted,unchanged,dry_run:dry}];
}
function output(value,json){if(json)return JSON.stringify(value,null,2);if(!Array.isArray(value))return JSON.stringify(value,null,2);const rows=value.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v instanceof Date?v.toISOString():v])));return table(rows,Object.keys(rows[0]||{}).map(key=>({key,label:key,width:90})));}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();console.log(output(await run(db,process.argv.slice(2)),process.argv.includes('--json')));}catch(e){if(process.argv.includes('--json'))console.error(JSON.stringify({error:e.message}));else console.error(e.message);process.exitCode=1;}finally{await db?.close();}}
