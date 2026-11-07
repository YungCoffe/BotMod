import { OWNER_IDS } from './config.js';

const owners = new Set(OWNER_IDS);

/** O "dono do bot" é o único que pode dar/tirar cargos acima do próprio cargo. */
export const isBotOwner = (userId) => owners.has(userId);

/** Soma o dono da aplicação no Discord (ou o dono da equipe) à lista do OWNER_IDS. */
export async function loadBotOwners(client) {
  try {
    const application = await client.application.fetch();
    const owner = application.owner;
    const id = owner?.ownerId ?? owner?.id; // equipe: ownerId · usuário: id
    if (id) owners.add(id);
  } catch (error) {
    console.error('[dono] não consegui descobrir o dono do bot:', error.message);
  }

  return [...owners];
}
