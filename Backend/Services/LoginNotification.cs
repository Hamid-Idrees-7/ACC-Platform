namespace Backend.Services
{
    // The notification a user receives every time they sign in. Shared by the normal login
    // and the live demo (first sign-in, role switch, "View as") so both look exactly the same.
    public static class LoginNotification
    {
        public const string Category = "Login";
        public const string Title = "Welcome back";

        public static string Message(DateTime signedInAt) =>
            $"You logged in on {signedInAt:dd MMMM yyyy 'at' h:mm tt}.";
    }
}
