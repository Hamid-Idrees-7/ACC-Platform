namespace Backend.Models.DTOs
{
    // "Forgot password?": the username or the email address of the account.
    public class ForgotPasswordDto
    {
        public string Login { get; set; } = string.Empty;
    }

    // The code from the email link, to check it before the new password is typed.
    public class ResetCodeDto
    {
        public string Code { get; set; } = string.Empty;
    }

    public class ResetPasswordDto
    {
        public string Code { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }
}
