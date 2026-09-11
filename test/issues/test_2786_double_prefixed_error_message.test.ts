import { Client } from '../../src/client/index.js';
import { InMemoryTransport } from '../../src/inMemory.js';
import { Server } from '../../src/server/index.js';
import { CallToolRequestSchema, ErrorCode, McpError } from '../../src/types.js';

/**
 * https://github.com/modelcontextprotocol/typescript-sdk/issues/2786
 *
 * `McpError.message` carries a `MCP error <code>: ` prefix. The server used to
 * copy that message into the JSON-RPC `error.message` field, and the client
 * rebuilt an `McpError` from it — adding the prefix a second time.
 */
describe('issue 2786: a thrown McpError reaches the client with one prefix', () => {
    const connect = async () => {
        const server = new Server({ name: 'test', version: '1.0' }, { capabilities: { tools: {} } });
        server.setRequestHandler(CallToolRequestSchema, async () => {
            throw new McpError(ErrorCode.MethodNotFound, 'Unknown tool: nope');
        });

        const client = new Client({ name: 'test', version: '1.0' });
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

        return { client, server };
    };

    it('does not prefix the message twice', async () => {
        const { client } = await connect();

        await expect(client.callTool({ name: 'nope', arguments: {} })).rejects.toMatchObject({
            code: ErrorCode.MethodNotFound,
            message: 'MCP error -32601: Unknown tool: nope'
        });
    });

    it('sends the unprefixed message on the wire', async () => {
        const { client } = await connect();

        const error = await client.callTool({ name: 'nope', arguments: {} }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(McpError);
        expect((error as McpError).rawMessage).toBe('Unknown tool: nope');
    });
});
