import { z } from 'zod'
import { logger } from './logger'
import { CacheService } from './cache'
import { EventEmitter } from 'events'
import Fuse from 'fuse.js'
import { stemmer } from 'stemmer'

// Search configuration
interface SearchConfig {
  enableCaching: boolean
  enableAnalytics: boolean
  enableSuggestions: boolean
  enableHighlighting: boolean
  cacheTimeout: number
  maxResults: number
  minQueryLength: number
  enableFuzzySearch: boolean
  fuzzyThreshold: number
  enableStemming: boolean
  enableStopWords: boolean
}

const defaultSearchConfig: SearchConfig = {
  enableCaching: process.env.SEARCH_ENABLE_CACHING !== 'false',
  enableAnalytics: process.env.SEARCH_ENABLE_ANALYTICS !== 'false',
  enableSuggestions: true,
  enableHighlighting: true,
  cacheTimeout: parseInt(process.env.SEARCH_CACHE_TIMEOUT || '3600'), // 1 hour
  maxResults: parseInt(process.env.SEARCH_MAX_RESULTS || '100'),
  minQueryLength: parseInt(process.env.SEARCH_MIN_QUERY_LENGTH || '2'),
  enableFuzzySearch: true,
  fuzzyThreshold: parseFloat(process.env.SEARCH_FUZZY_THRESHOLD || '0.6'),
  enableStemming: true,
  enableStopWords: true,
}

// Search interfaces
interface SearchIndex {
  id: string
  name: string
  type: 'users' | 'tests' | 'questions' | 'consultations' | 'content' | 'mixed'
  fields: SearchField[]
  documents: SearchDocument[]
  settings: SearchIndexSettings
  createdAt: Date
  updatedAt: Date
}

interface SearchField {
  name: string
  type: 'text' | 'keyword' | 'number' | 'date' | 'boolean'
  weight: number
  searchable: boolean
  filterable: boolean
  sortable: boolean
  facetable: boolean
}

interface SearchDocument {
  id: string
  type: string
  title: string
  content: string
  fields: Record<string, any>
  metadata: Record<string, any>
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

interface SearchIndexSettings {
  analyzer: 'standard' | 'simple' | 'keyword'
  enableSynonyms: boolean
  synonyms: Record<string, string[]>
  stopWords: string[]
  customFilters: string[]
}

interface SearchQuery {
  query: string
  filters?: SearchFilter[]
  sort?: SearchSort[]
  facets?: string[]
  highlight?: SearchHighlight
  pagination?: SearchPagination
  options?: SearchOptions
}

interface SearchFilter {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'startswith' | 'endswith' | 'range'
  value: any
  values?: any[]
}

interface SearchSort {
  field: string
  direction: 'asc' | 'desc'
}

interface SearchHighlight {
  fields: string[]
  preTag: string
  postTag: string
  maxFragments: number
  fragmentSize: number
}

interface SearchPagination {
  page: number
  size: number
  offset?: number
}

interface SearchOptions {
  fuzzy?: boolean
  stemming?: boolean
  synonyms?: boolean
  boost?: Record<string, number>
  explain?: boolean
}

interface SearchResult {
  documents: SearchResultDocument[]
  total: number
  page: number
  size: number
  facets?: SearchFacet[]
  suggestions?: string[]
  executionTime: number
  query: string
}

interface SearchResultDocument {
  id: string
  type: string
  title: string
  content: string
  fields: Record<string, any>
  score: number
  highlights?: Record<string, string[]>
  explanation?: any
}

interface SearchFacet {
  field: string
  values: SearchFacetValue[]
}

interface SearchFacetValue {
  value: any
  count: number
  selected: boolean
}

interface SearchAnalytics {
  totalQueries: number
  uniqueQueries: number
  averageResponseTime: number
  topQueries: SearchQueryStats[]
  topResults: SearchResultStats[]
  noResultQueries: string[]
  clickThroughRate: number
}

interface SearchQueryStats {
  query: string
  count: number
  averageResponseTime: number
  resultCount: number
  clickThroughRate: number
}

interface SearchResultStats {
  documentId: string
  title: string
  clickCount: number
  impressionCount: number
  clickThroughRate: number
}

// Zod schemas
const searchFieldSchema = z.object({
  name: z.string(),
  type: z.enum(['text', 'keyword', 'number', 'date', 'boolean']),
  weight: z.number().min(0).max(10),
  searchable: z.boolean(),
  filterable: z.boolean(),
  sortable: z.boolean(),
  facetable: z.boolean(),
})

const searchDocumentSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  content: z.string(),
  fields: z.record(z.any()),
  metadata: z.record(z.any()),
  tags: z.array(z.string()),
})

const searchQuerySchema = z.object({
  query: z.string().min(1),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'startswith', 'endswith', 'range']),
    value: z.any().optional(),
    values: z.array(z.any()).optional(),
  })).optional(),
  sort: z.array(z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc']),
  })).optional(),
  facets: z.array(z.string()).optional(),
  pagination: z.object({
    page: z.number().min(1),
    size: z.number().min(1).max(1000),
  }).optional(),
})

// Text processing utilities
class TextProcessor {
  private stopWords: Set<string>
  private synonyms: Map<string, string[]>

  constructor(config: SearchConfig) {
    this.stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
      'had', 'what', 'said', 'each', 'which', 'their', 'time', 'if'
    ])

    this.synonyms = new Map([
      ['test', ['exam', 'quiz', 'assessment', 'evaluation']],
      ['question', ['query', 'inquiry', 'problem']],
      ['answer', ['response', 'reply', 'solution']],
      ['student', ['learner', 'pupil', 'scholar']],
      ['teacher', ['instructor', 'educator', 'tutor']],
    ])
  }

  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0)
  }

  removeStopWords(tokens: string[]): string[] {
    return tokens.filter(token => !this.stopWords.has(token))
  }

  stem(tokens: string[]): string[] {
    return tokens.map(token => stemmer(token))
  }

  expandSynonyms(tokens: string[]): string[] {
    const expanded: string[] = [...tokens]
    
    for (const token of tokens) {
      const synonyms = this.synonyms.get(token)
      if (synonyms) {
        expanded.push(...synonyms)
      }
    }
    
    return expanded
  }

  processText(text: string, options: {
    removeStopWords?: boolean
    stemming?: boolean
    expandSynonyms?: boolean
  } = {}): string[] {
    let tokens = this.tokenize(text)
    
    if (options.removeStopWords) {
      tokens = this.removeStopWords(tokens)
    }
    
    if (options.stemming) {
      tokens = this.stem(tokens)
    }
    
    if (options.expandSynonyms) {
      tokens = this.expandSynonyms(tokens)
    }
    
    return tokens
  }

  highlight(text: string, query: string, preTag = '<mark>', postTag = '</mark>'): string {
    const queryTokens = this.tokenize(query)
    let highlightedText = text
    
    for (const token of queryTokens) {
      const regex = new RegExp(`\\b${token}\\b`, 'gi')
      highlightedText = highlightedText.replace(regex, `${preTag}$&${postTag}`)
    }
    
    return highlightedText
  }
}

// Search engine
export class SearchEngine extends EventEmitter {
  private static instance: SearchEngine
  private config: SearchConfig
  private cache: CacheService
  private textProcessor: TextProcessor
  private indexes: Map<string, SearchIndex> = new Map()
  private fuseInstances: Map<string, Fuse<SearchDocument>> = new Map()
  private analytics: SearchAnalytics
  private queryLog: Map<string, SearchQueryStats> = new Map()

  private constructor(config: Partial<SearchConfig> = {}) {
    super()
    this.config = { ...defaultSearchConfig, ...config }
    this.cache = new CacheService()
    this.textProcessor = new TextProcessor(this.config)
    this.analytics = {
      totalQueries: 0,
      uniqueQueries: 0,
      averageResponseTime: 0,
      topQueries: [],
      topResults: [],
      noResultQueries: [],
      clickThroughRate: 0,
    }
  }

  static getInstance(config?: Partial<SearchConfig>): SearchEngine {
    if (!SearchEngine.instance) {
      SearchEngine.instance = new SearchEngine(config)
    }
    return SearchEngine.instance
  }

  // Create search index
  async createIndex(
    id: string,
    name: string,
    type: SearchIndex['type'],
    fields: SearchField[],
    settings: Partial<SearchIndexSettings> = {}
  ): Promise<void> {
    const index: SearchIndex = {
      id,
      name,
      type,
      fields,
      documents: [],
      settings: {
        analyzer: 'standard',
        enableSynonyms: true,
        synonyms: {},
        stopWords: [],
        customFilters: [],
        ...settings,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.indexes.set(id, index)
    this.createFuseInstance(index)

    await logger.info('Search index created', {
      indexId: id,
      name,
      type,
      fieldsCount: fields.length,
    })

    this.emit('index:created', index)
  }

  // Create Fuse.js instance for fuzzy search
  private createFuseInstance(index: SearchIndex): void {
    const searchableFields = index.fields
      .filter(field => field.searchable)
      .map(field => ({
        name: field.name,
        weight: field.weight,
      }))

    const fuseOptions = {
      keys: searchableFields,
      threshold: this.config.fuzzyThreshold,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: this.config.minQueryLength,
      shouldSort: true,
      findAllMatches: true,
    }

    const fuse = new Fuse(index.documents, fuseOptions)
    this.fuseInstances.set(index.id, fuse)
  }

  // Add document to index
  async addDocument(indexId: string, document: Omit<SearchDocument, 'createdAt' | 'updatedAt'>): Promise<void> {
    const index = this.indexes.get(indexId)
    if (!index) {
      throw new Error(`Index not found: ${indexId}`)
    }

    // Validate document
    searchDocumentSchema.parse(document)

    const fullDocument: SearchDocument = {
      ...document,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Remove existing document with same ID
    index.documents = index.documents.filter(doc => doc.id !== document.id)
    
    // Add new document
    index.documents.push(fullDocument)
    index.updatedAt = new Date()

    // Update Fuse instance
    this.createFuseInstance(index)

    await logger.debug('Document added to search index', {
      indexId,
      documentId: document.id,
      type: document.type,
    })

    this.emit('document:added', indexId, fullDocument)
  }

  // Remove document from index
  async removeDocument(indexId: string, documentId: string): Promise<void> {
    const index = this.indexes.get(indexId)
    if (!index) {
      throw new Error(`Index not found: ${indexId}`)
    }

    const initialLength = index.documents.length
    index.documents = index.documents.filter(doc => doc.id !== documentId)
    
    if (index.documents.length < initialLength) {
      index.updatedAt = new Date()
      this.createFuseInstance(index)
      
      await logger.debug('Document removed from search index', {
        indexId,
        documentId,
      })
      
      this.emit('document:removed', indexId, documentId)
    }
  }

  // Search documents
  async search(indexId: string, searchQuery: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now()
    
    // Validate query
    searchQuerySchema.parse(searchQuery)
    
    if (searchQuery.query.length < this.config.minQueryLength) {
      throw new Error(`Query too short. Minimum length: ${this.config.minQueryLength}`)
    }

    const index = this.indexes.get(indexId)
    if (!index) {
      throw new Error(`Index not found: ${indexId}`)
    }

    // Check cache
    const cacheKey = `search:${indexId}:${JSON.stringify(searchQuery)}`
    if (this.config.enableCaching) {
      const cachedResult = await this.cache.get<SearchResult>(cacheKey)
      if (cachedResult) {
        this.trackQuery(searchQuery.query, Date.now() - startTime, cachedResult.total)
        return cachedResult
      }
    }

    let documents = index.documents

    // Apply filters
    if (searchQuery.filters) {
      documents = this.applyFilters(documents, searchQuery.filters)
    }

    // Perform search
    let searchResults: SearchResultDocument[]
    
    if (this.config.enableFuzzySearch && searchQuery.options?.fuzzy !== false) {
      searchResults = await this.performFuzzySearch(indexId, searchQuery.query, documents)
    } else {
      searchResults = await this.performExactSearch(searchQuery.query, documents)
    }

    // Apply sorting
    if (searchQuery.sort) {
      searchResults = this.applySorting(searchResults, searchQuery.sort)
    }

    // Apply pagination
    const pagination = searchQuery.pagination || { page: 1, size: this.config.maxResults }
    const total = searchResults.length
    const startIndex = (pagination.page - 1) * pagination.size
    const endIndex = startIndex + pagination.size
    const paginatedResults = searchResults.slice(startIndex, endIndex)

    // Apply highlighting
    if (this.config.enableHighlighting && searchQuery.highlight) {
      this.applyHighlighting(paginatedResults, searchQuery.query, searchQuery.highlight)
    }

    // Generate facets
    const facets = searchQuery.facets ? this.generateFacets(documents, searchQuery.facets) : undefined

    // Generate suggestions
    const suggestions = this.config.enableSuggestions ? this.generateSuggestions(searchQuery.query, index) : undefined

    const executionTime = Date.now() - startTime
    
    const result: SearchResult = {
      documents: paginatedResults,
      total,
      page: pagination.page,
      size: pagination.size,
      facets,
      suggestions,
      executionTime,
      query: searchQuery.query,
    }

    // Cache result
    if (this.config.enableCaching) {
      await this.cache.set(cacheKey, result, this.config.cacheTimeout)
    }

    // Track analytics
    this.trackQuery(searchQuery.query, executionTime, total)

    this.emit('search:performed', indexId, searchQuery, result)
    return result
  }

  // Perform fuzzy search using Fuse.js
  private async performFuzzySearch(
    indexId: string,
    query: string,
    documents: SearchDocument[]
  ): Promise<SearchResultDocument[]> {
    const fuse = this.fuseInstances.get(indexId)
    if (!fuse) {
      throw new Error(`Fuse instance not found for index: ${indexId}`)
    }

    // Update Fuse with filtered documents
    fuse.setCollection(documents)
    
    const results = fuse.search(query)
    
    return results.map(result => ({
      id: result.item.id,
      type: result.item.type,
      title: result.item.title,
      content: result.item.content,
      fields: result.item.fields,
      score: 1 - (result.score || 0), // Convert Fuse score to relevance score
    }))
  }

  // Perform exact search
  private async performExactSearch(query: string, documents: SearchDocument[]): Promise<SearchResultDocument[]> {
    const queryTokens = this.textProcessor.processText(query, {
      removeStopWords: this.config.enableStopWords,
      stemming: this.config.enableStemming,
    })

    const results: SearchResultDocument[] = []

    for (const doc of documents) {
      const contentTokens = this.textProcessor.processText(doc.content, {
        removeStopWords: this.config.enableStopWords,
        stemming: this.config.enableStemming,
      })
      
      const titleTokens = this.textProcessor.processText(doc.title, {
        removeStopWords: this.config.enableStopWords,
        stemming: this.config.enableStemming,
      })

      let score = 0
      
      // Calculate relevance score
      for (const token of queryTokens) {
        const titleMatches = titleTokens.filter(t => t.includes(token)).length
        const contentMatches = contentTokens.filter(t => t.includes(token)).length
        
        score += titleMatches * 3 + contentMatches // Title matches weighted higher
      }

      if (score > 0) {
        results.push({
          id: doc.id,
          type: doc.type,
          title: doc.title,
          content: doc.content,
          fields: doc.fields,
          score: score / queryTokens.length, // Normalize score
        })
      }
    }

    return results.sort((a, b) => b.score - a.score)
  }

  // Apply filters to documents
  private applyFilters(documents: SearchDocument[], filters: SearchFilter[]): SearchDocument[] {
    return documents.filter(doc => {
      return filters.every(filter => {
        const fieldValue = doc.fields[filter.field] || doc[filter.field as keyof SearchDocument]
        
        switch (filter.operator) {
          case 'eq':
            return fieldValue === filter.value
          case 'ne':
            return fieldValue !== filter.value
          case 'gt':
            return fieldValue > filter.value
          case 'gte':
            return fieldValue >= filter.value
          case 'lt':
            return fieldValue < filter.value
          case 'lte':
            return fieldValue <= filter.value
          case 'in':
            return filter.values?.includes(fieldValue)
          case 'nin':
            return !filter.values?.includes(fieldValue)
          case 'contains':
            return String(fieldValue).toLowerCase().includes(String(filter.value).toLowerCase())
          case 'startswith':
            return String(fieldValue).toLowerCase().startsWith(String(filter.value).toLowerCase())
          case 'endswith':
            return String(fieldValue).toLowerCase().endsWith(String(filter.value).toLowerCase())
          case 'range':
            return fieldValue >= filter.values?.[0] && fieldValue <= filter.values?.[1]
          default:
            return true
        }
      })
    })
  }

  // Apply sorting to results
  private applySorting(results: SearchResultDocument[], sorts: SearchSort[]): SearchResultDocument[] {
    return results.sort((a, b) => {
      for (const sort of sorts) {
        const aValue = a.fields[sort.field] || a[sort.field as keyof SearchResultDocument]
        const bValue = b.fields[sort.field] || b[sort.field as keyof SearchResultDocument]
        
        let comparison = 0
        if (aValue < bValue) comparison = -1
        else if (aValue > bValue) comparison = 1
        
        if (comparison !== 0) {
          return sort.direction === 'desc' ? -comparison : comparison
        }
      }
      return 0
    })
  }

  // Apply highlighting to results
  private applyHighlighting(
    results: SearchResultDocument[],
    query: string,
    highlight: SearchHighlight
  ): void {
    for (const result of results) {
      result.highlights = {}
      
      for (const field of highlight.fields) {
        const fieldValue = result.fields[field] || result[field as keyof SearchResultDocument]
        if (typeof fieldValue === 'string') {
          result.highlights[field] = [
            this.textProcessor.highlight(fieldValue, query, highlight.preTag, highlight.postTag)
          ]
        }
      }
    }
  }

  // Generate facets
  private generateFacets(documents: SearchDocument[], facetFields: string[]): SearchFacet[] {
    const facets: SearchFacet[] = []
    
    for (const field of facetFields) {
      const values = new Map<any, number>()
      
      for (const doc of documents) {
        const fieldValue = doc.fields[field] || doc[field as keyof SearchDocument]
        if (fieldValue !== undefined) {
          values.set(fieldValue, (values.get(fieldValue) || 0) + 1)
        }
      }
      
      const facetValues: SearchFacetValue[] = Array.from(values.entries())
        .map(([value, count]) => ({ value, count, selected: false }))
        .sort((a, b) => b.count - a.count)
      
      facets.push({ field, values: facetValues })
    }
    
    return facets
  }

  // Generate search suggestions
  private generateSuggestions(query: string, index: SearchIndex): string[] {
    const suggestions: string[] = []
    const queryLower = query.toLowerCase()
    
    // Find similar terms in document titles and content
    const terms = new Set<string>()
    
    for (const doc of index.documents) {
      const titleTokens = this.textProcessor.tokenize(doc.title)
      const contentTokens = this.textProcessor.tokenize(doc.content)
      
      [...titleTokens, ...contentTokens].forEach((token: string) => {
        if (token.length >= this.config.minQueryLength && token.includes(queryLower)) {
          terms.add(token)
        }
      })
    }
    
    return Array.from(terms).slice(0, 10) // Return top 10 suggestions
  }

  // Track query analytics
  private trackQuery(query: string, responseTime: number, resultCount: number): void {
    if (!this.config.enableAnalytics) return
    
    this.analytics.totalQueries++
    
    // Update average response time
    this.analytics.averageResponseTime = 
      (this.analytics.averageResponseTime * (this.analytics.totalQueries - 1) + responseTime) / this.analytics.totalQueries
    
    // Track query stats
    const queryStats = this.queryLog.get(query) || {
      query,
      count: 0,
      averageResponseTime: 0,
      resultCount: 0,
      clickThroughRate: 0,
    }
    
    queryStats.count++
    queryStats.averageResponseTime = 
      (queryStats.averageResponseTime * (queryStats.count - 1) + responseTime) / queryStats.count
    queryStats.resultCount = resultCount
    
    this.queryLog.set(query, queryStats)
    
    // Track no-result queries
    if (resultCount === 0 && !this.analytics.noResultQueries.includes(query)) {
      this.analytics.noResultQueries.push(query)
    }
    
    // Update unique queries count
    this.analytics.uniqueQueries = this.queryLog.size
    
    // Update top queries
    this.analytics.topQueries = Array.from(this.queryLog.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  // Get search analytics
  getAnalytics(): SearchAnalytics {
    return { ...this.analytics }
  }

  // Get search index
  getIndex(indexId: string): SearchIndex | null {
    return this.indexes.get(indexId) || null
  }

  // List all indexes
  listIndexes(): SearchIndex[] {
    return Array.from(this.indexes.values())
  }

  // Delete index
  async deleteIndex(indexId: string): Promise<void> {
    const index = this.indexes.get(indexId)
    if (!index) {
      throw new Error(`Index not found: ${indexId}`)
    }
    
    this.indexes.delete(indexId)
    this.fuseInstances.delete(indexId)
    
    await logger.info('Search index deleted', { indexId })
    this.emit('index:deleted', indexId)
  }

  // Clear cache
  async clearCache(): Promise<void> {
    // Implementation depends on cache service
    await logger.info('Search cache cleared')
  }
}

// Predefined search indexes
export const SearchIndexes = {
  USERS: {
    id: 'users',
    name: 'Users',
    type: 'users' as const,
    fields: [
      { name: 'name', type: 'text' as const, weight: 3, searchable: true, filterable: true, sortable: true, facetable: false },
      { name: 'email', type: 'text' as const, weight: 2, searchable: true, filterable: true, sortable: true, facetable: false },
      { name: 'role', type: 'keyword' as const, weight: 1, searchable: false, filterable: true, sortable: true, facetable: true },
      { name: 'createdAt', type: 'date' as const, weight: 0, searchable: false, filterable: true, sortable: true, facetable: false },
    ],
  },
  
  TESTS: {
    id: 'tests',
    name: 'Tests',
    type: 'tests' as const,
    fields: [
      { name: 'title', type: 'text' as const, weight: 4, searchable: true, filterable: true, sortable: true, facetable: false },
      { name: 'description', type: 'text' as const, weight: 2, searchable: true, filterable: false, sortable: false, facetable: false },
      { name: 'subject', type: 'keyword' as const, weight: 1, searchable: true, filterable: true, sortable: true, facetable: true },
      { name: 'difficulty', type: 'keyword' as const, weight: 1, searchable: false, filterable: true, sortable: true, facetable: true },
      { name: 'duration', type: 'number' as const, weight: 0, searchable: false, filterable: true, sortable: true, facetable: true },
      { name: 'isPublished', type: 'boolean' as const, weight: 0, searchable: false, filterable: true, sortable: false, facetable: true },
    ],
  },
  
  QUESTIONS: {
    id: 'questions',
    name: 'Questions',
    type: 'questions' as const,
    fields: [
      { name: 'question', type: 'text' as const, weight: 4, searchable: true, filterable: false, sortable: false, facetable: false },
      { name: 'type', type: 'keyword' as const, weight: 1, searchable: false, filterable: true, sortable: true, facetable: true },
      { name: 'difficulty', type: 'keyword' as const, weight: 1, searchable: false, filterable: true, sortable: true, facetable: true },
      { name: 'subject', type: 'keyword' as const, weight: 1, searchable: true, filterable: true, sortable: true, facetable: true },
      { name: 'tags', type: 'keyword' as const, weight: 2, searchable: true, filterable: true, sortable: false, facetable: true },
    ],
  },
} as const

// Export singleton instance
export const searchEngine = SearchEngine.getInstance()

export default searchEngine