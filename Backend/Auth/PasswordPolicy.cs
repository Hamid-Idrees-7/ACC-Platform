namespace Backend.Auth
{
    // The password rule, used everywhere a password is set: Settings > Account, Users (create
    // and reset) and the admin register endpoint. The frontend strength meter shows the same rules.
    public static class PasswordPolicy
    {
        public const int MinLength = 8;
        public const int MaxLength = 128;

        // Returns a message for the first rule the password breaks, or null when it is fine.
        public static string? Validate(string? password)
        {
            if (string.IsNullOrEmpty(password))
                return "Enter a password.";
            if (password.Length < MinLength)
                return $"The password must be at least {MinLength} characters.";
            if (password.Length > MaxLength)
                return $"The password can be at most {MaxLength} characters.";
            if (password != password.Trim())
                return "The password can't start or end with a space.";
            if (!password.Any(char.IsLetter) || !password.Any(char.IsDigit))
                return "Use at least one letter and one number.";

            return null;
        }
    }
}
