# MotoGasto Vistoria — atualização final

Esta versão muda o sistema para CHECK-IN VISTORIA diário.

Cada check-in salva:
- Dono da moto
- Moto / Modelo
- Placa
- Piloto do dia
- KM
- Data
- Hora de chegada
- Serviços/produtos realizados
- Quantidade e valor
- Total
- Observações

O piloto NÃO fica fixo na moto. Cada check-in guarda o piloto daquele dia.

## INSTALAÇÃO MAIS AUTOMÁTICA

1. No GitHub, no repositório Motogasto, vá em:
   Settings > Secrets and variables > Actions
2. Crie um secret:
   Nome: APPWRITE_API_KEY
   Valor: sua API Key do Appwrite
3. Extraia este ZIP e envie TODOS os arquivos para o repositório, mantendo a pasta:
   .github/workflows/setup-appwrite.yml
4. No GitHub, vá em Actions.
5. Abra "Configurar MotoGasto Vistoria".
6. Clique em "Run workflow".
7. Espere ficar verde.

O workflow cria automaticamente as tabelas:
- produtos
- checkins
- checkin_itens

Não apaga dados antigos e não mexe em outros projetos.

Depois abra:
https://andersoongamerx-sudo.github.io/Motogasto/

## IMPORTANTE
Depois que o workflow terminar com sucesso, você pode apagar/revogar a API Key usada no setup.
