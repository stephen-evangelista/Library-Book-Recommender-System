# Library Book Recommender System

A web-based Search & Recommendation System built entirely with Vanilla JavaScript, HTML, and CSS. This project was developed as a Semestral Output for the Data Structures and Algorithms (DSA) course.

## 🚀 Features
- **Live Autocomplete Search:** Finds books instantly as you type.
- **Top 5 Highest Rated:** Dynamically ranks and displays the best books.
- **Related Books Recommendation:** Suggests similar books based on genre using a Graph.
- **Full CRUD Management:** Add, Edit, and Delete books (Admin view).
- **Interactive UI:** Modern dark-mode design with glassmorphism effects.

## 🧠 Custom Data Structures & Algorithms
This system implements the following from scratch (no built-in JS Dictionaries):
- **BookHashTable (Separate Chaining):** O(1) average time complexity for book lookups by ID.
- **Trie:** Used for the fast autocomplete search bar (prefix matching).
- **MaxHeap (Priority Queue):** Keeps the "Top 5 Highest Rated" books sorted in O(log N) time.
- **Merge Sort:** Custom O(N log N) sorting for Title, Author, and Rating.
- **Graph BFS (Breadth-First Search):** Traverses a graph of related book genres to recommend similar titles.

## 🛠️ How to Run

The application is deployed and fully playable live on the web! No installation is required. 

👉 **[Click here to open the Library Book Recommender System](https://stephen-evangelista.github.io/Library-Book-Recommender-System/)**

*(Optional: If you want to run it locally, you can clone this repository and open `index.html` in any modern web browser.)*

## 👨‍💻 Author
**Stephen Evangelista**  
BSIS 2 - Data Structures and Algorithms
