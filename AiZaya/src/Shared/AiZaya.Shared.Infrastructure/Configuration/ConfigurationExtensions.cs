using Microsoft.Extensions.Configuration;

namespace AiZaya.Shared.Infrastructure.Configuration;

public static class ConfigurationExtensions
{
    extension(IConfiguration configuration)
    {
        public string GetConnectionStringOrThrow(string name)
        {
            return configuration.GetConnectionString(name) ??
                   throw new InvalidOperationException($"Строка подключения {name} была не найдена");
        }

        public T GetValueOrThrow<T>(string name)
        {
            return configuration.GetValue<T?>(name) ??
                   throw new InvalidOperationException($"Значение {name} было не найдено");
        }
    }
}
