Turnstile

 * Turnstile is a work queue. Conduit is a message queue. The difference being
 that Turnstile passes the optional callback to receiving end of the queue
 whereas Conduit holds onto the callback waiting for a response and passes only
 serializable data through the queue.
