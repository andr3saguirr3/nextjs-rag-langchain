import { ChatOpenAI } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import dotenv from "dotenv";
import docs from "./pdfLoader.js";

dotenv.config();

const model = new ChatOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-3.5-turbo",
    temperature: 0,
    streaming: true,
    verbose: true,
});

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

const splits = await textSplitter.splitDocuments(docs);

const vectorstore = await MemoryVectorStore.fromDocuments(
  splits,
  new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY })
);

const retriever = vectorstore.asRetriever();

// Definir la plantilla del sistema para el RAG
const systemTemplate = `
  You are an assistant for question-answering tasks.
  Use the following pieces of retrieved context to answer the question.
  If you don't know the answer, say that you don't know. Use three sentences maximum and keep the answer concise.
  \n\n{context}
`;

const prompt = ChatPromptTemplate.fromMessages([
  { role: "system", content: systemTemplate },
  { role: "user", content: "{input}" }
]);

// Crear la cadena de procesamiento de documentos
const questionAnswerChain = await createStuffDocumentsChain({
  llm: model, // LLM es el modelo que se pasa aquí
  prompt: prompt, // El prompt que construimos con context y user input
  documentSeparator: "\n\n", // Separador de documentos, puede ser ajustado
});

// Crear la cadena RAG (Retrieval-Augmented Generation)
const ragChain = await createRetrievalChain({
  retriever,
  combineDocsChain: questionAnswerChain,
});

// Hacer la invocación con la pregunta de entrada
const results = await ragChain.invoke({
  input: "crea 3 preguntas con sus respectivas respuestas del documento",
});

console.log(results);
