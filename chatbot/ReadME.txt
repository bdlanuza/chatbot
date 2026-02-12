RAG

1 Create table in pgadmin4
2 Fine tune the needed information for data semantic search in the n8n workflow
3 Import file to gdrive and run workflow
4 Example pgadmin4 in creating a table based on the model used for embedding
	
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    content TEXT,
    embedding VECTOR(768)
);


5 Check the webhook connection and API configuration