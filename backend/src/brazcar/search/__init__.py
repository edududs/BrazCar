"""search: find documents by text. Its core imports only the stdlib, so it can leave this project.

The port is an index (`SearchIndex`): what fills it and what it holds is the caller's business,
how it matches is the adapter's. Today a table with folded text and "contains"; Redis or
Elasticsearch are other adapters of the same port (D-100).
"""
