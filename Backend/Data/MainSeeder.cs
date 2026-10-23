using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data
{
    // Gives a brand-new main database a single administrator to sign in with, so a freshly deployed
    // site is usable from the first run. It runs only when the database has no users yet, so an
    // existing database is never touched. The main system starts clean: the administrator adds the
    // real company data. The per-visitor demo seeds its own populated schemas separately.
    //
    // The administrator's username, password and email come from configuration (Seed:AdminUsername,
    // Seed:AdminPassword and Seed:AdminEmail), so a live deployment sets its own strong values and a
    // real address for password reset emails, while local development falls back to simple defaults.
    public static class MainSeeder
    {
        public static async Task SeedAsync(AppDbContext db, IConfiguration config, CancellationToken ct = default)
        {
            if (await db.Users.AnyAsync(ct))
                return;

            var now = AppTime.Now;
            var username = Setting(config, "Seed:AdminUsername", "hamid");
            var password = Setting(config, "Seed:AdminPassword", "hamid");
            var email = Setting(config, "Seed:AdminEmail", "admin@acc.com.pk");

            db.Users.Add(new User
            {
                Username = username,
                FullName = "Hamid Idrees",
                Email = email,
                Role = "Admin",
                Bio = "Administrator with full access to every module, approvals and access control.",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            });
            await db.SaveChangesAsync(ct);
        }

        // A key left blank counts as not set, so an empty entry in the settings file or an empty
        // environment variable can never seed a blank administrator.
        private static string Setting(IConfiguration config, string key, string fallback)
        {
            var value = config[key];
            return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
        }
    }
}
