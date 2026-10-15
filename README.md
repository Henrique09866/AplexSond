
<p align="center">
  <img src="./assets/images/logoaplexsond.png" alt="AplexSond Logo" width="250" style="border-radius: 50%; object-fit: cover;">
</p>

<h1 align="center">AplexSond</h1>

<p align="center">
  Um player de música moderno para Android desenvolvido com React Native.
</p>

Seu player de música offline, privado e fluido.

## 📖 Sobre o Projeto

O SondLize é um aplicativo mobile de reprodução de música offline desenvolvido em React Native. O foco principal do projeto é fornecer uma experiência de audição limpa, sem anúncios e sem dependência de internet, gerenciando arquivos de áudio locais diretamente no dispositivo do usuário.

O app também sincroniza os dados do usuário com o Firebase, permitindo manter seu perfil, pastas, playlists e biblioteca na nuvem.

Este projeto foi construído do zero enfrentando desafios complexos de arquitetura nativa, migração de motores de áudio e gerenciamento de estado em larga escala.

## ✨ Funcionalidades

- Reprodução de áudio offline com fila, controle de mídia e notificações em background
- Parse de metadados (capa, artista, título) via ID3 tags
- Perfil com foto de perfil (com ajuste de corte) e nome
- Pastas e playlists personalizadas
- Letras das músicas
- Sincronização de dados com Firebase (Auth, Firestore e Storage)
- Suporte a Nova Arquitetura (Bridgeless)

## 🛠️ Tech Stack

- **Framework:** React Native (Expo SDK 54)
- **Linguagem:** TypeScript
- **Gerenciamento de Estado:** Zustand
- **Navegação:** React Navigation v7
- **Motor de Áudio:** @rntp/player (player principal) & expo-av (leitura de áudio auxiliar)
- **Armazenamento Local:** expo-file-system & @react-native-async-storage/async-storage
- **Backend/Cloud:** Firebase (Auth, Firestore e Storage para sincronização de dados)
- **Metadados:** jsmediatags (Parse de ID3 tags de arquivos MP3/WAV)

## ⚙️ Como Rodar o Projeto

> ⚠️ **Nota:** Este projeto utiliza módulos nativos (como @rntp/player e expo-file-system). O uso do aplicativo padrão "Expo Go" não é compatível. É necessário gerar um build de desenvolvimento.

### Pré-requisitos

- Node.js >= 18
- Android Studio & SDK configurado (variáveis de ambiente `ANDROID_HOME` ativas)
- Um dispositivo físico Android (recomendado) ou emulador

### Passos

```bash
# 1. Clone o repositório
git clone https://github.com/Henrique09866/SondLize.git
cd sondlize

# 2. Instale as dependências
npm install

# 3. Gere os arquivos nativos
npx expo prebuild

# 4. Rode no dispositivo conectado
npx expo run:android
```

### Gerando o APK

Para gerar um APK instalável via build na nuvem (EAS):

```bash
eas build -p android --profile preview
```

## 🚧 Status do Desenvolvimento (WIP)

O projeto está em desenvolvimento ativo. As funcionalidades principais já foram implementadas, mas ajustes finos de UI/UX estão em andamento.

- [x] Reprodução de áudio offline
- [x] Parse de metadados (capa, artista, título)
- [x] Gerenciamento de fila de reprodução
- [x] Suporte a Nova Arquitetura (Bridgeless)
- [x] Copiagem segura de arquivos temporários para armazenamento permanente
- [x] Refatoração dos controles da UI do Player
- [x] Implementação de notificações de mídia interativas em background
- [x] Perfil com foto e nome
- [ ] Sistema de equalização

## 📝 Licença

Este projeto é de uso pessoal e educacional.
