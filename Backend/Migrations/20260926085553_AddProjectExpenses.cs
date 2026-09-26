using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectExpenses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ExpenseID",
                table: "InvoiceItems",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProjectExpenses",
                columns: table => new
                {
                    ExpenseID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProjectID = table.Column<int>(type: "int", nullable: false),
                    PhaseID = table.Column<int>(type: "int", nullable: true),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ExpenseDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PaidTo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Reference = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    IsRecoverable = table.Column<bool>(type: "bit", nullable: false),
                    CreatedByUserID = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectExpenses", x => x.ExpenseID);
                    table.ForeignKey(
                        name: "FK_ProjectExpenses_Projects_ProjectID",
                        column: x => x.ProjectID,
                        principalTable: "Projects",
                        principalColumn: "ProjectID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceItems_ExpenseID",
                table: "InvoiceItems",
                column: "ExpenseID",
                unique: true,
                filter: "[ExpenseID] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectExpenses_ProjectID",
                table: "ProjectExpenses",
                column: "ProjectID");

            migrationBuilder.AddForeignKey(
                name: "FK_InvoiceItems_ProjectExpenses_ExpenseID",
                table: "InvoiceItems",
                column: "ExpenseID",
                principalTable: "ProjectExpenses",
                principalColumn: "ExpenseID",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InvoiceItems_ProjectExpenses_ExpenseID",
                table: "InvoiceItems");

            migrationBuilder.DropTable(
                name: "ProjectExpenses");

            migrationBuilder.DropIndex(
                name: "IX_InvoiceItems_ExpenseID",
                table: "InvoiceItems");

            migrationBuilder.DropColumn(
                name: "ExpenseID",
                table: "InvoiceItems");
        }
    }
}
