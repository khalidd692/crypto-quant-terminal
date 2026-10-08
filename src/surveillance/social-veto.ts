import type { SocialSentimentContext } from "../context/types.js";
export function applySocialVeto(decision:"ENTRER"|"ATTENDRE"|"NE_PAS_ENTRER"|"SORTIR",social:SocialSentimentContext):{decision:typeof decision;reason:string}{
 if(decision!=="ENTRER")return{decision,reason:"Sentiment social ne crée ni sortie ni entrée."};
 if(social.temperature==="UNAVAILABLE")return{decision:"ATTENDRE",reason:"Sentiment social UNAVAILABLE: entrée dégradée par fail-closed."};
 if(social.temperature==="HOT")return{decision:"ATTENDRE",reason:"Euphorie/attention sociale élevée: le filtre peut seulement dégrader ENTRER en ATTENDRE."};
 return{decision,reason:"Indice social non bloquant."};
}