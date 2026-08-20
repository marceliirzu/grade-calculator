# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy the project file alone first so `restore` is cached against dependency changes only.
# Copying everything up front would invalidate the restore layer on every source edit.
COPY GradeCalculator.API.csproj ./
RUN dotnet restore GradeCalculator.API.csproj

COPY . ./
RUN dotnet publish GradeCalculator.API.csproj -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish .

# Run as a non-root user. The base image ships one; the API writes nothing to disk, so it
# needs no ownership changes.
USER $APP_UID

EXPOSE 8080

# The port is resolved at RUNTIME, not build time.
#
# The previous `ENV ASPNETCORE_URLS=http://+:${PORT:-5000}` looked correct but was evaluated
# while the image was being built, when PORT does not exist — so it baked in the literal
# string "http://+:5000". Railway assigns a port at container start and routes to it, so the
# app listened on the wrong port and every request returned 502.
#
# Shell-form ENTRYPOINT defers the substitution to container start, where PORT is set.
ENTRYPOINT ["/bin/sh", "-c", "exec dotnet GradeCalculator.API.dll --urls http://+:${PORT:-8080}"]
