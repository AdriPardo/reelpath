---
type: community
cohesion: 0.30
members: 14
---

# idea-generator/src/index.ts

**Cohesion:** 0.30 - loosely connected
**Members:** 14 nodes

## Members
- [[LlmIdeaItem]] - code - backend/services/idea-generator/src/index.ts
- [[RankedIdea]] - code - backend/services/idea-generator/src/index.ts
- [[ensureSelectedIdea()]] - code - backend/services/idea-generator/src/index.ts
- [[fetchTrends()]] - code - backend/services/idea-generator/src/index.ts
- [[fetchUsedTopics()]] - code - backend/services/idea-generator/src/used-topics.ts
- [[formatUsedTopicsConstraint()]] - code - backend/services/idea-generator/src/used-topics.ts
- [[generateIdeas()]] - code - backend/services/idea-generator/src/index.ts
- [[idea-generatorsrcindex.ts]] - code - backend/services/idea-generator/src/index.ts
- [[isTopicDuplicate()]] - code - backend/services/idea-generator/src/used-topics.ts
- [[normalizeTopicKey()]] - code - backend/services/idea-generator/src/used-topics.ts
- [[persistSelectedIdea()]] - code - backend/services/idea-generator/src/index.ts
- [[pickGlobalBest()]] - code - backend/services/idea-generator/src/index.ts
- [[selectBestIdea()]] - code - backend/services/idea-generator/src/index.ts
- [[used-topics.ts]] - code - backend/services/idea-generator/src/used-topics.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/idea-generator/src/indexts
SORT file.name ASC
```
