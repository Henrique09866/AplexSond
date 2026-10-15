<p align="center">
  <img src="./assets/images/logoaplexsond.png" alt="AplexSond Logo" width="250" style="border-radius: 50%; object-fit: cover;">
</p>

<h1 align="center">AplexSond</h1>

<p align="center">
  Um player de música moderno para Android, web e desktop, feito com React Native.
</p>

Seu player de música offline, privado e fluido. Sem anúncios, sem login e sem dependência de internet: as músicas, pastas, playlists e preferências ficam no próprio dispositivo.

## 💿 Sobre o Projeto

O **AplexSond** é um aplicativo de reprodução de música offline desenvolvido com React Native (Expo SDK 54). O foco principal é fornecer uma experiência de audição limpa e rápida, gerenciando arquivos de áudio locais diretamente no dispositivo do usuário.

Este projeto agora é totalmente offline e open source: não usa Firebase, contas ou sincronização em nuvem. Cada instalação é independente e os dados permanecem no aparelho.

## ✨ Funcionalidades

- Reprodução de áudio offline com fila, controles de mídia e notificações em segundo plano
- Parse de metadados (capa, artista, título) via ID3 tags
- Pastas e playlists personalizadas
- Letras das músicas com edição manual (texto simples ou LRC)
- Refatoração dos controles da UI do Player
- Cópia segura de arquivos temporários para armazenamento permanente
- Recuperação de músicas do armazenamento do app
- Suporte a Nova Arquitetura (Bridgeless)
- Adaptação automática para telas grandes / desktop (Windows)
- Interface totalmente offline e privada

## 🧰 Tech Stack

- **Framework:** React Native (Expo SDK 54)
- **Linguagem:** TypeScript
- **Gerenciamento de Estado:** Zustand
- **Navegação:** React Navigation v7
- **Motor de Áudio:** @rntp/player (player principal) & expo-av (leitura de áudio auxiliar)
- **Armazenamento Local:** expo-file-system & @react-native-async-storage/async-storage
- **Metadados:** jsmediatags (parse de ID3 tags de arquivos MP3/WAV)
- **Desktop:** Electron + electron-builder (Windows)

## 🚀 Como Rodar o Projeto

### Pré-requisitos

- Node.js >= 18
- Android Studio & SDK configurado (variáveis de ambiente `ANDROID_HOME` ativas)
- Um dispositivo físico Android (recomendado) ou emulador

### Passos

```bash
# 1. Clone o repositório
git clone https://github.com/Henrique09866/SondLize.git
cd SondLize

# 2. Instale as dependências
npm install

# 3. Gere os arquivos nativos
npx expo prebuild

# 4. Rode no dispositivo conectado
npx expo run:android
```

### Rodar no navegador (Web)

```bash
npm install
npm run web
```

### Gerar instalador para Windows (Desktop)

```bash
npm install
npm run desktop:build
```

O instalador será gerado em `desktop/release/`.

### Gerando o APK (EAS)

```bash
eas build -p android --profile preview
```

## 📊 Status do Desenvolvimento (WIP)

O projeto está em desenvolvimento ativo. As funcionalidades principais já foram implementadas, mas ajustes finos de UI/UX estão em andamento.

- [x] Reprodução de áudio offline
- [x] Parse de metadados (capa, artista, título)
- [x] Gerenciamento de fila de reprodução
- [x] Suporte a Nova Arquitetura (Bridgeless)
- [x] Cópia segura de arquivos temporários para armazenamento permanente
- [x] Refatoração dos controles da UI do Player
- [x] Implementação de notificações de mídia interativas em background
- [x] Edição de letras por música
- [x] Adaptação automática para desktop (Windows)
- [ ] Sistema de equalização

## 📄 Licença

Este projeto é de uso pessoal e educacional.
