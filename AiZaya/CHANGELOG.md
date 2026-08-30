# Changelog

All notable changes to the AiZaya project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0

### Features

- Initial migration of `Gateway.Shared` (Domain + Feature + Infrastructure) to `AiZaya.Shared` (узел 15.1).
- Added `AiZaya.Shared.Domain` with `Result`/`Result<T>` pattern, `Error`/`ErrorType`/`RuleError`, `Entity<TId>`, `ValueObject`, `AggregateRoot<TId>`/`AggregateRootConcurrency<TId, TRowVersion>`, `IDomainEvent`/`DomainEvent`, and DDD `Rule`/`RuleBuilder`/`CascadeMode`.
- Added `AiZaya.Shared.Feature` with `IDateTimeProvider`, `IDbConnectionFactory`, `IUnitOfWork`, `IEndpoint`/endpoint route builders, `AiZayaException`/`AiZayaExceptionHandler`/`AiZayaConcurrencyException`/`ConflictError`, MediatR `ICommand`/`IQuery`/`IDomainEventHandler` contracts, `ExceptionPipelineBehavior`/`RulePipelineBehavior`, OpenAPI transformers/models/parsers/attributes, `ApiResults.Problem`, and `ValidatorExtensions.Validate` (FluentValidation ↔ domain `Rule` bridge).
- Added `AiZaya.Shared.Infrastructure` with `DateTimeProvider`, `ConfigurationExtensions` (GetConnectionStringOrThrow/GetValueOrThrow), `DbConnectionFactory` (Npgsql), `AiZayaDbContext<TContext>` (with `ConcurrencySaveChangesAsync` translating EF Core `DbUpdateConcurrencyException` into `AiZayaConcurrencyException`), `OutboxMessage`/`OutboxMessageConsumer` + EF Core `IEntityTypeConfiguration`s, `OutboxMessagesInterceptor` (SaveChanges hook), `DomainEventHandlersFactory` (cached assembly handler lookup), and `ISerializerOptions`/`SerializerOptions`/`DomainEventJsonConverter` (System.Text.Json converter for `IDomainEvent` round-trip via `$type` discriminator).
- Added three test projects with xUnit:
  - `AiZaya.Shared.Domain.UnitTest` — 42 tests covering Result, Error, RuleBuilder, ValueObject, AggregateRoot, Entity, ResultExtensions.
  - `AiZaya.Shared.Feature.UnitTest` — 22 tests covering Clock contract, Endpoint discovery, Exceptions, Behaviors, ApiResults, MediatR contracts (ICommand/IQuery/IDomainEventHandler).
  - `AiZaya.Shared.Infrastructure.UnitTest` — 8 tests covering OutboxMessage/OutboxMessageConsumer POCOs and DomainEventJsonConverter round-trip / `$type` discrimination.
- `InternalsVisibleTo("AiZaya.Shared.Feature.UnitTest")` and `InternalsVisibleTo("AiZaya.Shared.Infrastructure.UnitTest")` added to the corresponding `.csproj` to enable white-box testing of internal types.

### Bug Fixes

- Cleaned up `AiZaya.Api/Program.cs`: removed pre-existing compile errors (`WebAIZaya` typo, missing `WeatherForecast` record). The starter `/weatherforecast` endpoint is removed per the user's request to keep the API surface minimal.
- Fixed `Result.cs` (AiZaya.Shared.Domain) `Equals(object? obj)` pattern-matching bug where `obj.GetType()` after `obj is null` check caused CS0023 ("An object reference is required for the non-static field"). Switched to `this.GetType()`.
- **Reviewer-driven fix**: changed `RulePipelineBehavior<TRequest, TResponse>` constraint from `where TRequest : notnull` (Gateway-стиль, валидация для всех запросов) to `where TRequest : IBaseCommand` (Application-development-стиль, валидация только для команд). This aligns with the priority-2 reference project (`C:\Users\Moroz\Desktop\аналоги и примеры для форка morozcode\Application-development\src\Shared\Application.Shared.Features\Behaviors\RulePipelineBehavior.cs:12`) and ensures `IQuery<TResponse>` (read-only) does not go through the validation pipeline. Updated `BehaviorsTests.TestRequest` → `TestCommand` to satisfy the new constraint.

### Notes

- Total: **72 unit tests, all passing** (`AiZaya.slnx` build: 0 errors).
- Shared projects (`AiZaya.Shared.Domain`, `AiZaya.Shared.Feature`, `AiZaya.Shared.Infrastructure`) build with 0 errors / 0 warnings.
- Pre-existing modules in `src/Modules/` (Users, KnowledgeBases, Prompts) are still excluded from `AiZaya.slnx` and are out of scope for this sub-session.
- Source priority for the review: **Gateway (1) → Application-development (2) → Evently (3)**. Structural divergence with Application-development flagged in the `critic` review has been addressed (only `RulePipelineBehavior` constraint was a real conflict; other items like `namespace` mismatch between `Errors/`/`Rules/` folders and `AiZaya.Shared.Domain.Results` namespace are intentional and match Gateway's design).
