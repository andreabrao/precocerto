# PreçoCerto — comunidade geolocalizada em Curitiba e Itaperuçu

MVP local de uma plataforma híbrida: consumidores comparam a cesta perto de onde estão, enviam etiquetas de preço e ganham pontos por contribuições confirmadas; o varejo acompanha movimentos de preço em Curitiba e Itaperuçu.

## O que está pronto

1. **Comparação geolocalizada**: cobertura separada para Curitiba e Itaperuçu, com raio de 1 a 15 km e prioridade por menor preço ou mercado mais próximo.
2. **Privacidade de localização**: o navegador pede permissão; as coordenadas são arredondadas, usadas na consulta/envio atual e não há histórico de trajetos.
3. **Envio de etiqueta**: participantes enviam foto JPG, PNG ou WebP de até 5 MB, junto com mercado, produto e preço. Em Itaperuçu, onde ainda não há lojas validadas na base, o participante informa o nome real do mercado fotografado.
4. **Validação e pontos**: duas pessoas diferentes precisam registrar o mesmo preço, produto e mercado em até 48 horas. As duas recebem 15 pontos quando a contribuição é validada.
5. **Ranking e alertas**: o ranking usa contribuições confirmadas. Alertas de preço aparecem dentro do app quando uma fonte válida registra o valor-alvo.

Fotos ficam no armazenamento de objetos `CONTRIBUTION_IMAGES`; dados estruturados, pontos, alertas e referências ficam na base D1 `DB`.

## Executar localmente

```bash
pnpm install
pnpm run dev
```

Abra `http://localhost:3000`. A base local é criada e preenchida automaticamente na primeira chamada à API.

## Aplicativo instalável (PWA)

O PreçoCerto pode ser instalado pelo botão **Instalar app**. No celular, quando o navegador não exibir o aviso automático, abra o menu do navegador e escolha **Instalar aplicativo** ou **Adicionar à tela inicial**.

O PWA guarda a estrutura visual do app para abrir novamente sem internet. Dados de comparação, alertas, contribuições e APIs não entram no cache, para evitar a exibição de preços desatualizados. A instalação funciona em `localhost` durante o desenvolvimento e requer HTTPS quando o site for publicado.

## Fluxo de comunidade

1. A pessoa escolhe um apelido para participar neste dispositivo.
2. Autoriza a localização aproximada e fotografa uma etiqueta.
3. Seleciona mercado/produto e informa o preço lido.
4. O sistema armazena a foto e deixa a contribuição pendente.
5. Quando uma segunda pessoa confirma a mesma oferta, ambas recebem pontos e um aviso interno.

Esse perfil por dispositivo é adequado ao MVP local. Antes de um lançamento público, implemente login real por telefone/e-mail e controles antifraude; não exponha pontos ou recompensas financeiras sem autenticação.

## QR Code de NFC-e

O app reconhece localmente a URL pública de um QR Code de NFC-e do Paraná, por imagem ou colagem da URL. Ele aceita somente endereços `fazenda.pr.gov.br` nos formatos públicos de consulta e oferece um link para a consulta oficial.

- A imagem do QR e a URL da NFC-e não são enviadas ao PreçoCerto nem viram uma base de cupons.
- O recurso não tenta contornar CAPTCHA, automatizar a consulta completa da SEFA ou extrair resultados do portal.
- Para dados regionais e automatizados do Menor Preço, use apenas um canal formal, API ou licença de dados autorizada pela SEFA/PR.

## APIs do MVP

| Endpoint | Uso |
| --- | --- |
| `GET /api/comparison?basket=<ids>&lat=<latitude>&lng=<longitude>&radiusKm=8&sort=price` | Compara a cesta no raio escolhido. |
| `POST /api/community/contributors` | Cria um perfil de participação por apelido. |
| `POST /api/community/contributions` | Recebe a foto da etiqueta em `multipart/form-data`. |
| `GET /api/community/summary?contributorId=<id>` | Retorna perfil, ranking, alertas e metas de preço. |
| `GET /api/community/leaderboard` | Retorna o ranking público do piloto. |
| `POST /api/community/alerts/preferences` | Salva um alerta de preço-alvo. |
| `POST /api/import/observations` | Recebe preço de encarte/feed autorizado e dispara alertas internos. |

## Importação por fonte autorizada

Para a importação local, copie `.dev.vars.example` para `.dev.vars` e defina uma `IMPORT_API_KEY` forte. O conector parceiro envia um `POST` para `/api/import/observations` com o cabeçalho `x-import-key`. Use o arquivo [authorized-observation.json](examples/authorized-observation.json) como contrato inicial.

Tipos de origem aceitos:

- `official_flyer`: encarte oficial com URL HTTPS obrigatória.
- `authorized_feed`: API, feed ou e-commerce com autorização formal e URL HTTPS obrigatória.
- `manual_review`: preço conferido manualmente, sujeito a revisão.

O projeto não realiza scraping de fontes sem permissão. Antes de ativar um conector externo, registre a autorização do mercado/marca e mantenha URL de origem e validade da promoção.

## Possível fonte governamental

O Menor Preço do Nota Paraná é uma referência forte para Curitiba e Itaperuçu porque consulta valores de NFC-e e usa localização para mostrar ofertas próximas. A aplicação não deve automatizar endpoints internos não documentados. O caminho correto é solicitar à SEFA/PR/Nota Paraná um canal formal de dados, permissão de integração ou uma API/documentação destinada a parceiros antes de criar um conector.

## Verificação

```bash
pnpm run db:generate
pnpm run build
pnpm run test
pnpm run lint
```
