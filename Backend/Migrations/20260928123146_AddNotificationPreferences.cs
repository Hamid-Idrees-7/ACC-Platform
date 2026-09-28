using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MutedNotifications",
                table: "UserPreferences",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "NotificationSound",
                table: "UserPreferences",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "FromSelf",
                table: "Notifications",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MutedNotifications",
                table: "UserPreferences");

            migrationBuilder.DropColumn(
                name: "NotificationSound",
                table: "UserPreferences");

            migrationBuilder.DropColumn(
                name: "FromSelf",
                table: "Notifications");
        }
    }
}
