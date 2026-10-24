# Contribuindo com o AplexSond

Obrigado pelo interesse em contribuir com o **AplexSond**! Este é um player de música offline, privado e open source feito com React Native (Expo).

## Como contribuir

1. Faça um **fork** deste repositório.
2. Crie uma branch a partir de `main`:
   ```bash
   git checkout -b sua-feature
   ```
3. Faça suas alterações e commit:
   ```bash
   git commit -m "feat: sua mensagem aqui"
   ```
4. Envie para o seu fork:
   ```bash
   git push origin sua-feature
   ```
5. Abra um **Pull Request** contra a branch `main` deste repositório.

## Padrões de commit

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — nova funcionalidade
- `fix:` — correção de bug
- `refactor:` — refatoração de código
- `docs:` — alterações na documentação
- `style:` — formatação, ponto e vírgula, etc. (sem alterar lógica)
- `test:` — adição ou correção de testes
- `chore:` — tarefas de manutenção (dependências, CI, etc.)

## Antes de abrir um PR

- Certifique-se de que o código passa no linter:
  ```bash
  npm run lint
  ```
- Certifique-se de que o TypeScript está sem erros:
  ```bash
  npm run typecheck
  ```
- Teste o app em um dispositivo ou emulador Android antes de enviar.

## Relatando bugs

Abra uma issue descrevendo:
- O que você esperava que acontecesse
- O que aconteceu de fato
- Passos para reproduzir
- Versão do app, dispositivo e Android/iOS

## Código de conduta

Este projeto adota o [Código de Conduta](CODE_OF_CONDUCT.md). Ao participar, você concorda em segui-lo.

## Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a [MIT License](LICENSE).
