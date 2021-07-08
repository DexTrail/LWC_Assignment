var _messageChannel = null;
var _messageHandler = null;
var _message = null;

export const APPLICATION_SCOPE = Symbol('APPLICATION_SCOPE');
export const createMessageChannel = jest.fn();
export const createMessageContext = jest.fn();
export const MessageContext = jest.fn();
export const releaseMessageContext = jest.fn();
export const unsubscribe = jest.fn();

export const subscribe = jest.fn(
  (messageContext, messageChannel, messageHandler) => {
    _messageChannel = messageChannel;
    _messageHandler = messageHandler;
  }
);

export const publish = jest.fn(
  (messageContext, messageChannel, message) => {
    _messageChannel = messageChannel;
    _message = message;
    if (_messageHandler instanceof Function) _messageHandler(message);
  }
);
