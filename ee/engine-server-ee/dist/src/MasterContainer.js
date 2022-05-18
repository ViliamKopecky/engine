"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterContainerFactory = void 0;
const utils_1 = require("./utils");
const http_1 = require("./http");
const engine_http_1 = require("@contember/engine-http");
const prom_client_1 = __importDefault(require("prom-client"));
const crypto_1 = require("crypto");
const ProjectGroupContainerResolver_1 = require("./projectGroup/ProjectGroupContainerResolver");
const ProjectGroupResolver_1 = require("./projectGroup/ProjectGroupResolver");
class MasterContainerFactory {
    constructor(baseContainerFactory) {
        this.baseContainerFactory = baseContainerFactory;
    }
    createBuilder({ processType, serverConfig, ...args }) {
        return this.baseContainerFactory.createBuilder({ ...args, serverConfig })
            .addService('processType', () => processType)
            .addService('projectGroupContainerResolver', ({ tenantConfigResolver, projectGroupContainerFactory }) => new ProjectGroupContainerResolver_1.ProjectGroupContainerResolver(tenantConfigResolver, projectGroupContainerFactory))
            .addService('promRegistry', ({ processType, projectGroupContainerResolver }) => {
            if (processType === utils_1.ProcessType.clusterMaster) {
                const register = new prom_client_1.default.AggregatorRegistry();
                prom_client_1.default.collectDefaultMetrics({ register });
                return register;
            }
            const register = prom_client_1.default.register;
            prom_client_1.default.collectDefaultMetrics({ register });
            const registrar = (0, utils_1.createDbMetricsRegistrar)(register);
            projectGroupContainerResolver.onCreate.push((groupContainer, slug) => {
                groupContainer.projectContainerResolver.onCreate.push(projectContainer => registrar({
                    connection: projectContainer.connection,
                    labels: {
                        contember_module: 'content',
                        contember_project: projectContainer.project.slug,
                        contember_project_group: slug !== null && slug !== void 0 ? slug : 'unknown',
                    },
                }));
                return registrar({
                    connection: groupContainer.tenantContainer.connection,
                    labels: {
                        contember_module: 'tenant',
                        contember_project_group: slug !== null && slug !== void 0 ? slug : 'unknown',
                        contember_project: 'unknown',
                    },
                });
            });
            return register;
        })
            .replaceService('koaMiddlewares', ({ inner, promRegistry }) => {
            return (0, engine_http_1.compose)([
                (0, http_1.createColllectHttpMetricsMiddleware)(promRegistry),
                inner,
            ]);
        })
            .replaceService('projectGroupResolver', ({ projectGroupContainerResolver }) => {
            var _a, _b, _c, _d, _e;
            const encryptionKey = ((_a = serverConfig.projectGroup) === null || _a === void 0 ? void 0 : _a.configEncryptionKey)
                ? (0, crypto_1.createSecretKey)(Buffer.from((_b = serverConfig.projectGroup) === null || _b === void 0 ? void 0 : _b.configEncryptionKey, 'hex'))
                : undefined;
            return new ProjectGroupResolver_1.ProjectGroupResolver((_c = serverConfig.projectGroup) === null || _c === void 0 ? void 0 : _c.domainMapping, (_d = serverConfig.projectGroup) === null || _d === void 0 ? void 0 : _d.configHeader, ((_e = serverConfig.projectGroup) === null || _e === void 0 ? void 0 : _e.configEncryptionKey) ? new engine_http_1.CryptoWrapper(encryptionKey) : undefined, projectGroupContainerResolver);
        })
            .addService('monitoringKoa', ({ promRegistry }) => {
            const app = new engine_http_1.Koa();
            app.use((0, http_1.createShowMetricsMiddleware)(promRegistry));
            return app;
        });
    }
    create(args) {
        const container = this.createBuilder(args).build();
        return container.pick('initializer', 'koa', 'monitoringKoa', 'providers');
    }
}
exports.MasterContainerFactory = MasterContainerFactory;
//# sourceMappingURL=MasterContainer.js.map