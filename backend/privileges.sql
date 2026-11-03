-- Run as schema owner after creating a non-owner rentkeep_app LOGIN role.
GRANT USAGE ON SCHEMA rentkeep TO rentkeep_app;
GRANT SELECT, INSERT, UPDATE ON rentkeep.workspace TO rentkeep_app;
GRANT SELECT, INSERT ON rentkeep.operations TO rentkeep_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON rentkeep.devices TO rentkeep_app;
GRANT SELECT, INSERT, UPDATE ON rentkeep.deliveries TO rentkeep_app;
GRANT SELECT, INSERT, DELETE ON rentkeep.sessions TO rentkeep_app;
