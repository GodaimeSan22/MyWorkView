// src/hooks/useMondayAPI.jsx
import { useCallback } from 'react';
import mondaySdk from 'monday-sdk-js';

const monday = mondaySdk();

export const useMondayAPI = () => {

  const queryMonday = useCallback(async (query, variables = {}, retries = 3, delay = 500) => {
    try {
      const response = await monday.api(query, { variables });

     
      if (response.errors) {
        const rateLimitError = response.errors.some(err => err.message.includes('Rate limit passed') || err.message.includes('Rate limit exceeded'));

        if (rateLimitError && retries > 0) {
          console.warn(`useMondayAPI: Rate limit hit, retrying in ${delay / 1000}s... (Retries left: ${retries - 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));

          return queryMonday(query, variables, retries - 1, delay * 2);
        }

        throw new Error(response.errors.map(e => e.message).join('; '));
      }


      return response.data;
    } catch (error) {
      console.error("useMondayAPI: Error with request Monday API:", error);


      if (error.message.includes('Rate limit passed') && retries > 0) {
        console.warn(`useMondayAPI: Rate limit hit (caught), retrying in ${delay / 1000}s... (Retries left: ${retries - 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return queryMonday(query, variables, retries - 1, delay * 2);
      }
      throw error; 
    }
  }, []);

  return { queryMonday };
};