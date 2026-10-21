# Build stage: restore and publish a Release build.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first so the layer is cached when only source changes.
COPY Backend.csproj ./
RUN dotnet restore Backend.csproj

COPY . ./
RUN dotnet publish Backend.csproj -c Release -o /app/publish

# Runtime stage: the published app on the smaller ASP.NET runtime image.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./

# A sane local default. Render sets PORT at runtime and the entrypoint binds to it.
EXPOSE 8080

# PORT is only known at runtime, so it is read in the shell, not baked into an ENV line.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} dotnet Backend.dll"]
