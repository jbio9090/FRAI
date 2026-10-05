export interface UserForm {
    username: string;
    email: string;
    role: string;
    position: string;
    profile: File | null;
    preview?: string;
}

/**
 * Server-side validation keys for AccountController@store / @update.
 * The display name is validated as "name" even though the form field is
 * called "username", so both keys are accepted when reading errors.
 */
export type AccountFormErrors = Partial<
    Record<'name' | 'username' | 'email' | 'role' | 'position' | 'profile', string>
>;
