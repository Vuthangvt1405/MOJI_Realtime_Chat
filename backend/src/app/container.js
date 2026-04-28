import { makeAuthUseCases } from "../application/auth/authUseCases.js";
import { makeCallUseCases } from "../application/call/callUseCases.js";
import { makeConversationUseCases } from "../application/chat/conversationUseCases.js";
import { makeMessageUseCases } from "../application/chat/messageUseCases.js";
import { makeFriendUseCases } from "../application/friend/friendUseCases.js";
import { makeUserUseCases } from "../application/user/userUseCases.js";
import { freeImageGateway } from "../infrastructure/media/freeImageGateway.js";
import { smtpMailGateway } from "../infrastructure/notifications/smtpMailGateway.js";
import { repositories } from "../infrastructure/persistence/mongoose/repositories.js";
import { makeSocketGateway } from "../infrastructure/realtime/socketGateway.js";
import { securityServices } from "../infrastructure/security/securityServices.js";
import { io } from "../socket/index.js";

let container = null;

const createUseCases = () => {
  const socketGateway = makeSocketGateway(io);

  const conversationUseCases = makeConversationUseCases({
    repositories,
    socketGateway,
  });

  const messageUseCases = makeMessageUseCases({
    repositories,
    socketGateway,
    imageGateway: freeImageGateway,
  });

  const friendUseCases = makeFriendUseCases({
    repositories,
    socketGateway,
  });

  const authUseCases = makeAuthUseCases({
    repositories,
    securityServices,
    mailGateway: smtpMailGateway,
  });

  const callUseCases = makeCallUseCases({
    repositories,
  });

  const userUseCases = makeUserUseCases({
    repositories,
    imageGateway: freeImageGateway,
  });

  return {
    ...conversationUseCases,
    ...messageUseCases,
    ...friendUseCases,
    ...authUseCases,
    ...callUseCases,
    ...userUseCases,
  };
};

export const getContainer = () => {
  if (!container) {
    container = {
      useCases: createUseCases(),
    };
  }

  return container;
};
