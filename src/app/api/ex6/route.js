import axios from "axios";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import dotenv from "dotenv";
import { clear } from "console";

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
        "x-hasura-admin-secret": process.env.HASURA_ADMIN_SECRET,
        "Content-Type": "application/json; charset=utf-8"
      },
      data: {
        "resource_id": "resource_01j9q0cvaae7p903j5rwb52g9j",
        "from": "2024-10-08"
      }
    });
    return response.data;  // Retorna los datos de la respuesta
  } catch (error) {
    console.error("Error fetching bookings:", error.response ? error.response.data : error.message);
    return null;
  }
};

const bookingsData = await fetchBookings(); // Realizar solicitud Axios

// Definir la plantilla del sistema para el RAG
const systemTemplate = `
  You are an assistant for a booking data business.
  Your task is to help manage booking data based on user instructions.
  When creating new appointments, respond only with a JSON object containing the appointment details.
  Do not include any additional text or formatting. 

  If any data is missing, set its value as null.
  Booking data: {context}.
`;

// Si bookingsData existe, lo convertimos en una cadena legible por el modelo
const context = bookingsData ? JSON.stringify(bookingsData, null, 2) : "No booking data available";

// Crear el prompt con el contexto
const prompt = ChatPromptTemplate.fromMessages([
  { role: "system", content: systemTemplate },
  { role: "user", content: "{input}" }  // El usuario proporciona el input
]);

// Crear la cadena de procesamiento
const chain = RunnableSequence.from([
  prompt,
  llm,
  new StringOutputParser()
]);

// Validar si la respuesta es un JSON válido
const isValidJson = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch (error) {
    return false;
  }
};

// Función para enviar la nueva cita a la base de datos
const createBookingInDatabase = async (booking) => {
  try {
    const response = await axios({
      method: "POST",
      url: "https://qtree.hasura.app/api/rest/create-booking", // URL de tu endpoint para crear nuevas citas
      headers: {
        "x-hasura-admin-secret": process.env.HASURA_ADMIN_SECRET,
        "Content-Type": "application/json"
      },
      data: booking // Aquí enviamos el JSON de la nueva cita
    });
    console.log("Cita creada exitosamente:", response.data);
  } catch (error) {
    console.error("Error al crear la cita en la base de datos:", error.response ? error.response.data : error.message);
  }
};

// Integrar datos de Axios en el flujo RAG
const runRAGWithBookings = async (userInput) => {
  const patientName = extractPatientName(userInput); // Extrae el nombre del paciente
  console.log("Patient Name:", patientName);

  // if (patientName) {
  //   patientData = await fetchPatientByName(patientName); // Busca el paciente por nombre
  //   if (!patientData) {
  //     console.log(`No se encontró el paciente: ${patientName}`);
  //     return;
  //   }
  // } else {
  //   console.log("No se pudo detectar un nombre de paciente en el input.");
  //   return;
  // }
  
  if (bookingsData) {
    console.log("Bookings Data:", JSON.stringify(bookingsData, null, 2));
    
    // Hacer la invocación con el input del usuario
    const results = await chain.invoke({
      input: userInput,  // El input del doctor o secretaria
      context: context  // Pasar el `context` aquí
    });

    console.log("RAG Results:", results);

    // Verificar si la respuesta es un JSON válido
    if (isValidJson(results)) {
      const newBooking = JSON.parse(results); // Convertir el string en JSON

      console.log("Nueva cita en JSON:", newBooking);

      // Enviar la nueva cita a la base de datos
      //await createBookingInDatabase(newBooking);

    } else {
      console.log("La respuesta no es un JSON válido.");
    }
  } else {
    console.log("No se pudo obtener datos de las reservas.");
  }
};


const extractPatientName = (input) => {
  // Regex mejorado para detectar nombres y apellidos (considerando espacios)
  const regex = /(?:para|de)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/; // Captura un nombre y un apellido opcional
  const match = input.match(regex);
  return match ? match[1].trim() : null; // Devuelve el nombre completo
};

// Ejemplo de input del usuario
const userInput = "Crea una cita para Juan Aguirre el martes 10 de octubre a las 13 horas a las 14 horas.";
runRAGWithBookings(userInput);

