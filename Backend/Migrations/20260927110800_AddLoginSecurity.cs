using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddLoginSecurity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "IdleMinutes",
                table: "UserPreferences",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LoginActivities",
                columns: table => new
                {
                    LoginActivityID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserID = table.Column<int>(type: "int", nullable: true),
                    Username = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Result = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IpAddress = table.Column<string>(type: "nvarchar(45)", maxLength: 45, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastSeenAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EndedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EndReason = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoginActivities", x => x.LoginActivityID);
                    table.ForeignKey(
                        name: "FK_LoginActivities_Users_UserID",
                        column: x => x.UserID,
                        principalTable: "Users",
                        principalColumn: "UserID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LoginActivities_CreatedAt",
                table: "LoginActivities",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_LoginActivities_UserID_CreatedAt",
                table: "LoginActivities",
                columns: new[] { "UserID", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_LoginActivities_Username_IpAddress_CreatedAt",
                table: "LoginActivities",
                columns: new[] { "Username", "IpAddress", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LoginActivities");

            migrationBuilder.DropColumn(
                name: "IdleMinutes",
                table: "UserPreferences");
        }
    }
}
