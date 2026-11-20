# Visualizador de GitHub Pages

Encontre os sites publicados nos repositórios públicos de uma pessoa ou organização. [Abrir o visualizador](https://glauberlasantiago.github.io/VeRepositoriosGithub/)

## Como usar

1. Digite um nome de usuário, um `@usuário` ou o endereço de um perfil do GitHub e selecione **Buscar sites**.
2. Filtre os resultados pelo nome ou pela descrição. A busca aceita palavras com ou sem acento. Você também pode ordenar por nome ou atualização e alternar entre grade e lista.
3. Clique no nome do site para visitá-lo ou em **Ver código** para abrir o repositório. Para compartilhar o catálogo de um perfil, copie o endereço do navegador após a busca.

O visualizador lembra o tema e a visualização escolhidos neste navegador.

### Ver quais sites precisam de capa

Cada perfil abre com as capas ocultas. Clique em **Exibir capas** para consultar as páginas publicadas e mostrar as imagens de compartilhamento indicadas em Open Graph ou no Twitter Card. Você pode continuar pesquisando ou ordenando os sites durante a verificação. **Ocultar capas** volta à visualização compacta e interrompe a verificação. Se você exibir as capas novamente no mesmo catálogo, a busca continua de onde parou.

Marque **Mostrar só os sem capa** para listar as páginas que puderam ser lidas e não indicam imagem. Elas recebem a arte padrão do catálogo. Se o site estiver indisponível, bloquear a leitura pelo navegador ou indicar uma imagem que falhe ao carregar, o cartão mostra **Não foi possível verificar** e fica fora desse filtro. A verificação lê as páginas públicas e não altera os projetos.

## Executar localmente

```sh
git clone https://github.com/GlauberLASantiago/VeRepositoriosGithub.git
cd VeRepositoriosGithub
```

Abra `index.html` no navegador. Para testar o compartilhamento por URL, sirva a pasta por HTTP. Com Python instalado, execute `python -m http.server 8000` e acesse `http://localhost:8000`.

O projeto usa HTML, CSS e JavaScript estáticos. O catálogo consulta a API pública do GitHub, percorre as páginas de repositórios e seleciona os que têm `has_pages` ativo. Os links usam o endereço padrão do GitHub Pages. As buscas estão sujeitas ao limite de consultas anônimas da API.

## Contribuições

Sugestões, relatos de problemas e pull requests são bem-vindos.

Elaborado por [GlauberLASantiago](https://github.com/GlauberLASantiago).
