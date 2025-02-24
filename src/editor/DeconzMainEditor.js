class DeconzMainEditor extends DeconzEditor {

    constructor(node, options = {}) {
        super(node, $.extend(true, {
            have: {
                statustext: true,
                query: true,
                device: true,
                output_rules: false,
                commands: false,
                specific: false
            },
            device: {
                batteryFilter: false
            },
            output_rules: {
                format: {
                    single: true,
                    array: false,
                    sum: false,
                    average: false,
                    min: false,
                    max: false
                },
                type: {
                    attribute: true,
                    state: true,
                    config: true,
                    homekit: false,
                    scene_call: false,
                }
            },
            commands: {
                type: {
                    deconz_state: true,
                    homekit: true,
                    custom: true,
                    pause: true
                }
            },
            specific: {
                output: {}
            }
        }, options));

        this.subEditor = {};
        this.initDone = false;

        if (this.options.have.statustext) this.subEditor.statustext = new DeconzStatusTextEditor(this.node, this.options.statustext);
        // TODO pourquoi le device dois être init avant le query ???
        if (this.options.have.device) this.subEditor.device = new DeconzDeviceEditor(this.node, this.options.device);
        if (this.options.have.query) this.subEditor.query = new DeconzQueryEditor(this.node, this.options.query);
        if (this.options.have.specific) {
            switch (this.node.type) {
                case'deconz-output':
                    this.subEditor.specific = new DeconzSpecificOutputEditor(this.node, this.options.specific.output);
                    break;
                case 'deconz-server':
                    this.subEditor.specific = new DeconzSpecificServerEditor(this.node, this.options.specific.server);
                    break;
            }
        }
        if (this.options.have.output_rules) this.subEditor.output_rules = new DeconzOutputRuleListEditor(this.node, this.options.output_rules);
        if (this.options.have.commands) this.subEditor.commands = new DeconzCommandListEditor(this.node, this.options.commands);


    }

    get elements() {
        return {
            tipBox: 'node-input-tip-box',
            server: 'node-input-server',
        };
    }

    async configurationMigration() {
        // Check if we need configuration migration
        if ((this.node.config_version || 0) >= this.node._def.defaults.config_version.value) {
            return;
        }

        let config = {};
        for (const key of Object.keys(this.node._def.defaults)) {
            config[key] = this.node[key];
        }

        let data = {
            id: this.node.id,
            type: this.node.type,
            config: JSON.stringify(config)
        };

        let errorMsg = 'Error while migrating the configuration of the node from version ' +
            (this.node.config_version || 0) +
            ' to version ' +
            this.node._def.defaults.config_version.value +
            '.';

        let result = await $.getJSON(`${this.NRCD}/configurationMigration`, data).catch((t, u) => {
            this.$elements.tipBox.append(
                `<div class="form-tips form-warning"><p>Migration errors:</p><p>${errorMsg}</p></div>`
            );
        });

        if (!result || result.notNeeded) return;

        if (result.new) {
            for (const [key, value] of Object.entries(result.new)) {
                this.node[key] = value;
            }
        }

        if (result.delete && Array.isArray(result.delete)) {
            for (const key of result.delete) {
                delete this.node[key];
            }
        }

        let mapI18N = (msg) => msg.substr(0, 23) === 'node-red-contrib-deconz' ? RED._(msg) : msg;

        if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
            this.$elements.tipBox.append(
                '<div class="form-tips form-warning">' +
                '<p>Migration errors:</p>' +
                '<ul>' +
                `<li>${result.errors.map(mapI18N).join('</li><li>')}</li>` +
                '</ul>' +
                '</div>'
            );
        }

        if (result.info && Array.isArray(result.info) && result.info.length > 0) {
            this.$elements.tipBox.append(
                '<div class="form-tips">' +
                '<p>Migration info:</p>' +
                '<ul>' +
                `<li>${result.info.map(mapI18N).join('</li><li>')}</li>` +
                '</ul>' +
                '</div>'
            );
        }
    }


    async init() {
        /*
         * We need small timeout, too fire change event for server select,
         * it's because the configuration node send bad event on loading.
         * https://github.com/node-red/node-red/issues/2883#issuecomment-786314862
         */
        await new Promise(resolve => setTimeout(resolve, 100));

        // Init Editor
        await super.init();

        await this.configurationMigration();

        // We save the init promise in the instance to pause the output rule before connecting
        this.initPromises = [];
        for (const editor of Object.values(this.subEditor)) {
            this.initPromises.push(editor.init(this));
        }
        await Promise.all(this.initPromises);
        this.initDone = true;
        delete this.initPromises; // Can this cause issue ?

        let connectPromises = [];
        for (const editor of Object.values(this.subEditor)) {
            connectPromises.push(editor.connect());
        }
        await Promise.all(connectPromises);
    }

    get serverNode() {
        return this.node.type === 'deconz-server' ? this.node : RED.nodes.node(this.$elements.server.val());
    }

    /**
     * Check if the main sub editors are initialized
     * @returns {Promise<void>}
     */
    async isInitialized() {
        if (!this.initDone) await Promise.all(this.initPromises);
    }

    async updateQueryDeviceDisplay(options) {
        let type = this.subEditor.query.$elements.select.typedInput('type');
        switch (type) {
            case 'device':
                await this.subEditor.device.updateList(options);
                break;
            case 'json':
            case 'jsonata':
                if (this.subEditor.query.$elements.select.typedInput('validate'))
                    await this.subEditor.query.updateList(options);
                break;
        }

        await this.subEditor.device.display(type === 'device');
        await this.subEditor.query.display(type !== 'device');

    }

    oneditsave() {
        if (this.options.have.output_rules) {
            let newRules = this.subEditor.output_rules.value;
            this.node.outputs = newRules.length;
            this.node.output_rules = newRules;
        }
        if (this.options.have.commands) {
            this.node.commands = this.subEditor.commands.value;
        }
        if (this.options.have.specific) {
            this.node.specific = this.subEditor.specific.value;
        }

    }

}

