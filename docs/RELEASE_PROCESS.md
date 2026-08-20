# Processo de release do Titi

Este documento define o caminho único para transformar um commit aprovado em um instalador público. Ele vale para releases novas; relatórios de candidatos antigos ficam no histórico do `QA_PLAN.md` até serem separados em arquivos próprios.

## Fonte de verdade

| Informação | Fonte autoritativa | Réplicas verificadas |
| --- | --- | --- |
| Versão do aplicativo | `package.json` | `landing/package.json`, landing, README, notas e `latest.yml` |
| Escopo entregue e pendências | `BACKLOG.md` | README, landing e notas da release |
| Gate do candidato atual | `QA_PLAN.md` | resumo nas notas da release |
| Política de comunicação | `MARKETING_PLAN.md` | landing e README |
| Artefatos publicados | workflow `Release verificável` | GitHub Release e link da landing |

`pnpm qa:release-sync` bloqueia divergências de versão e download. O workflow da tag ainda valida que `vX.Y.Z` corresponde exatamente à versão declarada antes de construir qualquer artefato.

## Preparação do candidato

1. Atualizar a versão em `package.json` e `landing/package.json`, a URL/etiqueta da landing, README, `RELEASE_NOTES.md`, `QA_PLAN.md` e o gate atual do backlog.
2. Manter as notas honestas sobre assinatura, downloads adicionais, limitações e testes manuais pendentes.
3. Aprovar o CI do commit final em `main`; qualquer alteração posterior cria outro candidato.
4. Executar a matriz manual P0/P1 do `QA_PLAN.md` no instalador candidato e registrar somente hashes, tamanhos e resultados, nunca conversas ou dados pessoais.
5. Criar uma tag nova e imutável no formato `v<versão>`. Uma tag cujo número diverge do pacote falha antes do build.

## O que o workflow da tag faz

O workflow `.github/workflows/release.yml` executa em Windows limpo e:

1. instala dependências congeladas e audita segredos/dependências;
2. valida landing, tipos e testes;
3. prepara Electron, Parakeet e Supertonic a partir de versões e hashes fixados;
4. gera o NSIS no próprio commit da tag e verifica ASAR, fuses e recursos;
5. exige Authenticode em versão estável; uma beta sem certificado só pode sair como `unsigned-prerelease`;
6. confere versão, nome, tamanho e SHA-512 do instalador em `latest.yml`;
7. envia somente o EXE da versão, seu blockmap, `latest.yml`, `SHA256SUMS.txt` e `release-manifest.json` para uma release ainda não pública;
8. baixa novamente todos os ativos, compara seus SHA-256 com o candidato local e só então torna a release pública.

Se uma release já existir para a tag, o workflow falha. Corrigir uma publicação exige nova versão e nova tag; ativos de uma tag publicada não são substituídos silenciosamente.

## Assinatura

Para assinar no GitHub, configurar juntos os secrets `WINDOWS_CSC_LINK` e `WINDOWS_CSC_KEY_PASSWORD`. Configurar também a variável `WINDOWS_SIGNER_SUBJECT` para conferir o editor esperado.

Uma versão estável sem certificado é bloqueada. Durante a beta, a ausência de certificado é registrada no manifesto e nas notas como `unsigned-prerelease`; isso não elimina o aviso do SmartScreen e não pode ser descrito como versão estável recomendada.

## Rollback e retirada do download

Se um P0 aparecer depois da publicação:

1. marcar imediatamente a release afetada como problemática e retirar o CTA da landing;
2. manter o instalador e o relatório disponíveis para auditoria, sem substituir seus bytes;
3. orientar o testador a exportar o que precisa pelo próprio Titi e fechar o aplicativo;
4. reinstalar a última pré-release aprovada sobre o mesmo perfil em `%APPDATA%\titi-desktop`; não apagar o perfil automaticamente;
5. conferir versão interna, abertura das conversas e hashes dos stores esperados;
6. se o formato de dados não for retrocompatível, interromper o downgrade e publicar um hotfix/migrador, preservando uma cópia local do perfil;
7. só restaurar o CTA depois de o download público do hotfix passar pelo mesmo workflow e pela matriz crítica.

O rollback ainda precisa ser exercitado em Windows 10 e 11 limpos antes de ser considerado aprovado para uma versão estável.
