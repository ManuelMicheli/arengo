// Formato dell'handle. Deve coincidere con il CHECK su public.profiles.handle
// (migrazione 20261013100000_core_schema: '^[A-Za-z0-9_]{3,20}$', unicità su lower(handle)).
export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 20;
export const HANDLE_CHARS = "[a-z0-9_]";
