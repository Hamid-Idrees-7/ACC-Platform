using Backend.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data
{
    // Gives a brand-new main database a single administrator to sign in with, so a freshly deployed
    // site is usable from the first run. It runs only when the database has no users yet, so an
    // existing database is never touched. The main system starts clean: the administrator adds the
    // real company data. The per-visitor demo seeds its own populated schemas separately.
    //
    // The administrator's username and password come from configuration (Seed:AdminUsername and
    // Seed:AdminPassword), so a live deployment sets its own strong values while local development
    // falls back to simple defaults.
    public static class MainSeeder
    {
        public static async Task SeedAsync(AppDbContext db, IConfiguration config, CancellationToken ct = default)
        {
            if (await db.Users.AnyAsync(ct))
                return;

            var now = AppTime.Now;
            var username = config["Seed:AdminUsername"] ?? "hamid";
            var password = config["Seed:AdminPassword"] ?? "hamid";

            db.Users.Add(new User
            {
                Username = username,
                FullName = "Hamid Idrees",
                Email = "admin@acc.com.pk",
                Role = "Admin",
                Bio = "Administrator with full access to every module, approvals and access control.",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                IsActive = true,
                CreatedAt = now,
                UpdatedAt = now
            });
            await db.SaveChangesAsync(ct);
        }
    }
}
