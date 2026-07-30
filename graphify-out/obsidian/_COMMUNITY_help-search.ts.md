---
type: community
cohesion: 0.35
members: 11
---

# help-search.ts

**Cohesion:** 0.35 - loosely connected
**Members:** 11 nodes

## Members
- [[GET()]] - code - frontend/src/app/api/ayuda/search/route.ts
- [[HelpSearchIndex]] - code - frontend/src/lib/help/help-search.ts
- [[IndexedDoc]] - code - frontend/src/lib/help/help-search.ts
- [[getAllHelpArticles()]] - code - frontend/src/lib/help/help-content.ts
- [[getHelpSearchIndex()]] - code - frontend/src/lib/help/help-search.ts
- [[headingsFromMarkdown()]] - code - frontend/src/lib/help/help-search.ts
- [[help-search.ts]] - code - frontend/src/lib/help/help-search.ts
- [[normalize()]] - code - frontend/src/lib/help/help-search.ts
- [[searchroute.ts]] - code - frontend/src/app/api/ayuda/search/route.ts
- [[searchHelpIndex()]] - code - frontend/src/lib/help/help-search.ts
- [[stripMarkdown()]] - code - frontend/src/lib/help/help-search.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/help-searchts
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_help-content.ts]]
- 1 edge to [[_COMMUNITY_apisrclibplan-limits.ts]]
- 1 edge to [[_COMMUNITY_HelpArticle.tsx]]
- 1 edge to [[_COMMUNITY_HelpHome.tsx]]
- 1 edge to [[_COMMUNITY_aslugpage.tsx]]

## Top bridge nodes
- [[getAllHelpArticles()]] - degree 5, connects to 3 communities
- [[help-search.ts]] - degree 10, connects to 2 communities
- [[searchroute.ts]] - degree 6, connects to 1 community
- [[searchHelpIndex()]] - degree 5, connects to 1 community