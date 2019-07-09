module.exports = function(RED) {
    class deConzItemEvent {
        constructor(config) {
            RED.nodes.createNode(this, config);

            var node = this;
            node.config = config;
            node.cleanTimer = null;
            node.status({}); //clean

            //get server node
            node.server = RED.nodes.getNode(node.config.server);
            if (node.server) {
                node.server.devices[node.id] = 'event';

                node.server.on('onClose', () => this.onClose());
                node.server.on('onSocketError', () => this.onSocketError());
                node.server.on('onSocketClose', () => this.onSocketClose());
                node.server.on('onSocketOpen', () => this.onSocketOpen());
                node.server.on('onSocketPongTimeout', () => this.onSocketPongTimeout());
            } else {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: 'server node error'
                });
            }

            node.sendLastState();
        }


        sendLastState() {
            var node = this;
            node.status({});
        }

        onSocketPongTimeout() {
            var node = this;
            node.onSocketError();
        }

        onSocketError() {
            var node = this;
            node.status({
                fill: "yellow",
                shape: "dot",
                text: 'reconnecting...'
            });
        }

        onClose() {
            var node = this;
            node.onSocketClose();
        }

        onSocketClose() {
            var node = this;
            node.status({
                fill: "red",
                shape: "dot",
                text: 'disconnected'
            });
        }

        onSocketOpen() {
            var node = this;
            node.sendLastState();
        }

    }
    RED.nodes.registerType('deconz-event', deConzItemEvent);
};
