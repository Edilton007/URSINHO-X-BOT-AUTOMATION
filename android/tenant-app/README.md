# URSINHO X BOT AUTOMATION — Tenant App 1.1.0

Aplicação Android WebView para abrir o Tenant Panel hospedado pelo Backend. O endereço do servidor é configurável no primeiro arranque e guardado em SharedPreferences.

- Exige URL HTTPS e rejeita endereços HTTP.
- Permite navegação interna apenas no mesmo host; links externos são enviados ao navegador.
- O painel continua a autenticar o tenant com sua própria `TENANT API KEY`; não reutilize a chave do Agent.
- minSdk 24, compileSdk 35, Java 17, Android Gradle Plugin 8.5.2, Gradle 8.7.
- O modelo de compilação está em `docs/ci-templates/android-build.yml`. A compilação é executada pelo workflow principal `import-and-build.yml`; a instalação no dispositivo ainda não foi validada.
