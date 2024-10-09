import axios from "axios";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import dotenv from "dotenv";

dotenv.config();

// Configurar el modelo de OpenAI
const llm = new ChatOpenAI({ 
    apiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-3.5-turbo",
    temperature: 0,
    streaming: true,
    verbose: true,
});

// Obtener datos de Hasura con Axios
const fetchBookings = async () => {
  try {
    const response = await axios({
      method: "POST",
      url: "https://qtree.hasura.app/api/rest/next-bookings/",
      headers: {
        "x-hasura-admin-secret": "",
        "Content-Type": "application/json; charset=utf-8"
      },
      data: {
        "resource_id": "resource_01j9q0cvaae7p903j5rwb52g9j",
        "from": "2024-10-08"
      }
    })
    return response.data;  // Retorna los datos de la respuesta
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return null;
  }
};

const bookingsData = await fetchBookings(); // Realizar solicitud Axios

// Definir la plantilla del sistema para el RAG
const systemTemplate = `
  You are an assistant for question-answering tasks.
  Use the following pieces of retrieved context to answer the question.
  If you don't know the answer, say that you don't know. Use three sentences maximum and keep the answer concise.
  Here is the booking data you retrieved: {context}.
`;

// Si bookingsData existe, lo convertimos en una cadena legible por el modelo
const context = bookingsData ? JSON.stringify(bookingsData, null, 2) : "No data available";

// Crear el prompt con el contexto
const prompt = ChatPromptTemplate.fromMessages([
  { role: "system", content: systemTemplate},
  { role: "user", content: "{input}" }
]);

// Crear la cadena de procesamiento
const chain = RunnableSequence.from([
  prompt,
  llm,
  new StringOutputParser()
]);

// Integrar datos de Axios en el flujo RAG
const runRAGWithBookings = async () => {
  if (bookingsData) {
    console.log("Bookings Data:", bookingsData);
    
    // Hacer la invocación con una pregunta de entrada
    const results = await chain.invoke({
      input: "Cuales son los detalles del paciente?",
      context: context  // Pasar el `context` aquí
    });
  
    console.log("RAG Results:", results);
  } else {
    console.log("No se pudo obtener datos de las reservas.");
  }
};

// Ejecutar la función que realiza la solicitud y el RAG
runRAGWithBookings();
