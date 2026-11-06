/* =====================================================================
 * dsa.js — Custom Data Structures & Algorithms
 * ---------------------------------------------------------------------
 * Everything here is written from scratch. The core logic deliberately
 * avoids JS Map / Set / plain-object dictionaries; only arrays are used
 * as raw storage.
 *
 *   1. BookHashTable      – separate chaining, O(1) average lookup by ID
 *   2. Trie               – prefix search for live autocomplete
 *   3. MaxHeap            – "Top 5 Highest Rated" in O(n + k log n)
 *   4. mergeSort          – stable O(n log n) sort by title/author/rating
 *   5. BookGraph + BFS    – genre-based graph + bfsRecommendation()
 * ===================================================================== */
'use strict';

/* =====================================================================
 * 1. HASH TABLE (separate chaining)
 * ---------------------------------------------------------------------
 * Each bucket is the head of a singly linked list of HashNode objects.
 * Collisions simply extend the chain.
 *
 *   set / get / has / remove : O(1) average, O(n) worst case
 *   resize (rehash all)      : O(n), amortised O(1) per insert
 *   Space                    : O(n + capacity)
 * ===================================================================== */
class HashNode {
  constructor(key, value, next = null) {
    this.key = key;
    this.value = value;
    this.next = next; // next node in the same bucket's chain
  }
}

class BookHashTable {
  constructor(initialCapacity = 101, maxLoadFactor = 0.75) {
    this.capacity = initialCapacity;
    this.maxLoadFactor = maxLoadFactor;
    this.size = 0;
    this.buckets = new Array(initialCapacity).fill(null);
  }

  /** djb2 string hash, folded into [0, capacity). O(length of key) */
  _hash(key, capacity = this.capacity) {
    const str = String(key);
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = (((h << 5) + h) + str.charCodeAt(i)) >>> 0; // h * 33 + c  (mod 2^32)
    }
    return h % capacity;
  }

  /** Insert or update. O(1) average. */
  set(key, value) {
    const index = this._hash(key);
    let node = this.buckets[index];
    while (node !== null) {
      if (node.key === key) { node.value = value; return; } // update existing
      node = node.next;
    }
    this.buckets[index] = new HashNode(key, value, this.buckets[index]); // push at chain head
    this.size++;
    if (this.size / this.capacity > this.maxLoadFactor) this._resize();
  }

  /** Returns the stored value, or null if the key is missing. O(1) average. */
  get(key) {
    let node = this.buckets[this._hash(key)];
    while (node !== null) {
      if (node.key === key) return node.value;
      node = node.next;
    }
    return null;
  }

  /** O(1) average. */
  has(key) {
    let node = this.buckets[this._hash(key)];
    while (node !== null) {
      if (node.key === key) return true;
      node = node.next;
    }
    return false;
  }

  /** Removes a key. Returns true if something was removed. O(1) average. */
  remove(key) {
    const index = this._hash(key);
    let node = this.buckets[index];
    let prev = null;
    while (node !== null) {
      if (node.key === key) {
        if (prev === null) this.buckets[index] = node.next;
        else prev.next = node.next;
        this.size--;
        return true;
      }
      prev = node;
      node = node.next;
    }
    return false;
  }

  /** Doubles the bucket array and re-distributes every node. O(n). */
  _resize() {
    const newCapacity = this.capacity * 2 + 1;
    const newBuckets = new Array(newCapacity).fill(null);
    for (let i = 0; i < this.capacity; i++) {
      let node = this.buckets[i];
      while (node !== null) {
        const next = node.next;
        const idx = this._hash(node.key, newCapacity);
        node.next = newBuckets[idx];
        newBuckets[idx] = node;
        node = next;
      }
    }
    this.buckets = newBuckets;
    this.capacity = newCapacity;
  }

  /** Diagnostics for the UI. O(capacity + n). */
  stats() {
    let longestChain = 0;
    let usedBuckets = 0;
    for (let i = 0; i < this.capacity; i++) {
      let len = 0;
      for (let node = this.buckets[i]; node !== null; node = node.next) len++;
      if (len > 0) usedBuckets++;
      if (len > longestChain) longestChain = len;
    }
    return {
      size: this.size,
      capacity: this.capacity,
      usedBuckets,
      longestChain,
      loadFactor: this.size / this.capacity
    };
  }
}

/* =====================================================================
 * 2. TRIE (prefix tree) — autocomplete
 * ---------------------------------------------------------------------
 * Each node keeps two parallel arrays: `keys` (sorted characters) and
 * `children` (matching child nodes). Binary search finds a child in
 * O(log σ) where σ is the alphabet size actually used at that node, and
 * keeping `keys` sorted makes the DFS return results alphabetically.
 * A node's `ids` array holds the book IDs whose indexed text ends there.
 *
 *   insert(word)   : O(L · log σ)          L = word length
 *   search(prefix) : O(P · log σ + M)      P = prefix length, M = nodes visited
 *                    (stops early once `limit` results are collected)
 *   Space          : O(total characters inserted)
 * ===================================================================== */
class TrieNode {
  constructor() {
    this.keys = [];     // sorted single characters
    this.children = []; // children[i] belongs to keys[i]
    this.ids = [];      // book IDs terminating at this node
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
    this.wordCount = 0;
  }

  /** Binary search. Returns index if found, else -(insertPosition + 1). */
  _locate(node, ch) {
    let lo = 0;
    let hi = node.keys.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const k = node.keys[mid];
      if (k === ch) return mid;
      if (k < ch) lo = mid + 1;
      else hi = mid - 1;
    }
    return -(lo + 1);
  }

  /** Inserts `word` (already lower-cased) and tags its end node with bookId. */
  insert(word, bookId) {
    let node = this.root;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      const idx = this._locate(node, ch);
      if (idx >= 0) {
        node = node.children[idx];
      } else {
        const pos = -idx - 1;
        const child = new TrieNode();
        node.keys.splice(pos, 0, ch);
        node.children.splice(pos, 0, child);
        node = child;
      }
    }
    node.ids.push(bookId);
    this.wordCount++;
  }

  /**
   * Returns up to `limit` DISTINCT book IDs whose indexed text starts with
   * `prefix` (lower-case). Shorter matches come first, then alphabetical.
   */
  search(prefix, limit = Infinity) {
    let node = this.root;
    for (let i = 0; i < prefix.length; i++) {
      const idx = this._locate(node, prefix[i]);
      if (idx < 0) return [];
      node = node.children[idx];
    }
    const results = [];
    const seen = []; // seen[id] === true -> already collected (array used as bitmap)
    const dfs = (n) => {
      for (let i = 0; i < n.ids.length && results.length < limit; i++) {
        const id = n.ids[i];
        if (seen[id] !== true) { seen[id] = true; results.push(id); }
      }
      for (let i = 0; i < n.children.length && results.length < limit; i++) {
        dfs(n.children[i]);
      }
    };
    dfs(node);
    return results;
  }
}

/* =====================================================================
 * 3. MAX HEAP — Top-K highest rated
 * ---------------------------------------------------------------------
 * Array-backed binary heap: parent(i) = (i-1)>>1, children 2i+1 / 2i+2.
 * The comparator returns > 0 when `a` outranks `b`.
 *
 *   insert        : O(log n)
 *   extractMax    : O(log n)
 *   peek          : O(1)
 *   fromArray     : O(n)   (bottom-up heapify)
 *   topK(k)       : O(n + k log n)  — faster than sorting everything
 * ===================================================================== */
class MaxHeap {
  constructor(comparator = MaxHeap.byRating) {
    this.heap = [];
    this.cmp = comparator;
  }

  /** Higher rating wins; ties are broken alphabetically by title. */
  static byRating(a, b) {
    if (a.rating !== b.rating) return a.rating - b.rating;
    const x = String(a.title).toLowerCase();
    const y = String(b.title).toLowerCase();
    if (x < y) return 1;
    if (x > y) return -1;
    return 0;
  }

  get size() { return this.heap.length; }
  isEmpty() { return this.heap.length === 0; }
  peek() { return this.heap.length ? this.heap[0] : null; }

  insert(item) {
    this.heap.push(item);
    this._siftUp(this.heap.length - 1);
  }

  extractMax() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  _swap(i, j) {
    const t = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = t;
  }

  _siftUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.cmp(this.heap[i], this.heap[parent]) > 0) {
        this._swap(i, parent);
        i = parent;
      } else break;
    }
  }

  _siftDown(i) {
    const n = this.heap.length;
    while (true) {
      const left = 2 * i + 1;
      const right = left + 1;
      let largest = i;
      if (left < n && this.cmp(this.heap[left], this.heap[largest]) > 0) largest = left;
      if (right < n && this.cmp(this.heap[right], this.heap[largest]) > 0) largest = right;
      if (largest === i) break;
      this._swap(i, largest);
      i = largest;
    }
  }

  /** Builds a heap from an array in O(n). The input array is not modified. */
  static fromArray(items, comparator) {
    const h = new MaxHeap(comparator);
    h.heap = items.slice();
    for (let i = (h.heap.length >> 1) - 1; i >= 0; i--) h._siftDown(i);
    return h;
  }

  /** Returns the k highest-ranked items, best first. O(n + k log n). */
  static topK(items, k, comparator) {
    const h = MaxHeap.fromArray(items, comparator);
    const out = [];
    for (let i = 0; i < k && !h.isEmpty(); i++) out.push(h.extractMax());
    return out;
  }
}

/* =====================================================================
 * 4. MERGE SORT
 * ---------------------------------------------------------------------
 * Classic top-down divide & conquer. Stable (equal keys keep their
 * original order). Returns a NEW array; the input is left untouched.
 *
 *   Time  : O(n log n) in best, average and worst case
 *   Space : O(n) auxiliary per merge level
 *
 * key   : 'title' | 'author' | 'rating' | 'year' | 'id'
 * order : 'asc' | 'desc'
 * ===================================================================== */
function _compareBooks(a, b, key) {
  if (key === 'rating' || key === 'id' || key === 'year') return a[key] - b[key];
  const x = String(a[key]).toLowerCase();
  const y = String(b[key]).toLowerCase();
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
}

function _merge(left, right, key, dir) {
  const out = new Array(left.length + right.length);
  let i = 0, j = 0, k = 0;
  while (i < left.length && j < right.length) {
    // "<= 0" takes from the left on ties => stable
    if (_compareBooks(left[i], right[j], key) * dir <= 0) out[k++] = left[i++];
    else out[k++] = right[j++];
  }
  while (i < left.length) out[k++] = left[i++];
  while (j < right.length) out[k++] = right[j++];
  return out;
}

function mergeSort(books, key = 'title', order = 'asc') {
  if (books.length <= 1) return books.slice();
  const dir = order === 'desc' ? -1 : 1;
  const mid = Math.floor(books.length / 2);
  const left = mergeSort(books.slice(0, mid), key, order);
  const right = mergeSort(books.slice(mid), key, order);
  return _merge(left, right, key, dir);
}

/* =====================================================================
 * 5. GRAPH + BFS RECOMMENDATION
 * ---------------------------------------------------------------------
 * Queue: array + head pointer, so dequeue is O(1) (no Array.shift()).
 *
 * BookGraph: adjacency list indexed by book ID.
 *   Nodes  = books.
 *   Edges  = within each genre, books are ranked by rating and every book
 *            is linked to the 3 books on each side of it (so neighbours are
 *            similarly rated). The top-rated book of each genre is also
 *            linked to the next genre's top book so the graph is connected
 *            and BFS can fall back to another genre if a genre is tiny.
 *   Build  : O(n log n) for the per-genre sorts, O(n) edges.
 *   Space  : O(n + e)
 * ===================================================================== */
class Queue {
  constructor() { this.items = []; this.head = 0; }
  enqueue(x) { this.items.push(x); }                        // O(1)
  dequeue() {                                               // O(1)
    if (this.isEmpty()) return undefined;
    const x = this.items[this.head];
    this.items[this.head] = undefined;                      // let GC reclaim it
    this.head++;
    return x;
  }
  isEmpty() { return this.head >= this.items.length; }
  get size() { return this.items.length - this.head; }
}

const GRAPH_LINKS_PER_SIDE = 3;

class BookGraph {
  constructor() {
    this.adj = [];     // adj[id]    -> array of neighbour IDs
    this.genres = [];  // genres[id] -> genre string
    this.nodeCount = 0;
  }

  addNode(id, genre) {
    if (this.adj[id] === undefined) { this.adj[id] = []; this.nodeCount++; }
    this.genres[id] = genre;
  }

  addEdge(a, b) { // undirected
    this.adj[a].push(b);
    this.adj[b].push(a);
  }

  has(id) { return this.adj[id] !== undefined; }
  neighbors(id) { return this.adj[id] || []; }
  genreOf(id) { return this.genres[id]; }

  /** Builds the genre graph described above. */
  static fromBooks(books) {
    const graph = new BookGraph();
    const genreNames = [];
    const groups = [];

    // Group books by genre (linear search over a handful of genres).
    for (let i = 0; i < books.length; i++) {
      const b = books[i];
      graph.addNode(b.id, b.genre);
      let gi = -1;
      for (let j = 0; j < genreNames.length; j++) {
        if (genreNames[j] === b.genre) { gi = j; break; }
      }
      if (gi === -1) { genreNames.push(b.genre); groups.push([]); gi = groups.length - 1; }
      groups[gi].push(b);
    }

    const ranked = [];
    for (let gi = 0; gi < groups.length; gi++) {
      const sorted = mergeSort(groups[gi], 'rating', 'desc');
      ranked.push(sorted);
      // Nearest links first (d = 1) so BFS meets the closest matches first.
      for (let d = 1; d <= GRAPH_LINKS_PER_SIDE; d++) {
        for (let i = 0; i + d < sorted.length; i++) {
          graph.addEdge(sorted[i].id, sorted[i + d].id);
        }
      }
    }

    // Bridge edges keep the whole graph connected.
    for (let gi = 0; gi + 1 < ranked.length; gi++) {
      graph.addEdge(ranked[gi][0].id, ranked[gi + 1][0].id);
    }
    return graph;
  }
}

/**
 * Breadth-first search outward from `startBookId`.
 * Collects the first `count` books in the SAME genre (closest first). If the
 * genre runs out, the nearest books from other genres fill the remaining slots.
 *
 * Returns: [{ bookId, distance, sameGenre }]   (distance = number of hops)
 * Time  : O(V + E) worst case, but stops as soon as `count` same-genre books
 *         are found, so in practice it touches only a few dozen nodes.
 * Space : O(V) for the visited / distance arrays and the queue.
 */
function bfsRecommendation(startBookId, graph, count = 3) {
  if (!graph.has(startBookId)) return [];
  const startGenre = graph.genreOf(startBookId);

  const queue = new Queue();
  const visited = [];
  const distance = [];
  const sameGenre = [];
  const otherGenre = [];

  queue.enqueue(startBookId);
  visited[startBookId] = true;
  distance[startBookId] = 0;

  while (!queue.isEmpty() && sameGenre.length < count) {
    const current = queue.dequeue();
    const nbrs = graph.neighbors(current);
    for (let i = 0; i < nbrs.length; i++) {
      const nb = nbrs[i];
      if (visited[nb] === true) continue;
      visited[nb] = true;
      distance[nb] = distance[current] + 1;
      queue.enqueue(nb);

      if (graph.genreOf(nb) === startGenre) {
        if (sameGenre.length < count) {
          sameGenre.push({ bookId: nb, distance: distance[nb], sameGenre: true });
        }
      } else if (otherGenre.length < count) {
        otherGenre.push({ bookId: nb, distance: distance[nb], sameGenre: false });
      }
    }
  }
  return sameGenre.concat(otherGenre).slice(0, count);
}

// Allows quick Node-based testing; ignored by browsers.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BookHashTable, Trie, MaxHeap, mergeSort, BookGraph, Queue, bfsRecommendation };
}
