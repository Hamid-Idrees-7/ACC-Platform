using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectLinkToMaterialTransaction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PhaseID",
                table: "MaterialTransactions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProjectID",
                table: "MaterialTransactions",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PhaseID",
                table: "MaterialTransactions");

            migrationBuilder.DropColumn(
                name: "ProjectID",
                table: "MaterialTransactions");
        }
    }
}
