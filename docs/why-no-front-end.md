# Why there is no front end

This folder runs the rental desk through a database and plain-language recipes. Read-only HTML shows the week, fleet readiness and balances. It needs no web server.

A screen gives a visual booking calendar and drag-and-drop allocation. A mobile application adds field capture and an interface for drivers. Offline synchronisation needs conflict handling and a separate design. None of those is shipped here. Electronic signatures, online bookings, payment gateways, toll feeds and booking agents remain external services.

The free base suits an office team that works from a coding agent and checks reports. Enterprise DNA can build the needed interfaces and connections into its own version. Do not switch a depot that depends on a channel or device until that part has been implemented and tested.

The embedded database is for one process. A shared PostgreSQL database supports a team, with permissions and backups configured for the actual operator. Personal records in generated documents need the same care as the source database.
