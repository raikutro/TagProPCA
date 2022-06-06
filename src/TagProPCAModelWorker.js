import * as Comlink from 'comlink';
import TagProPCAModel from './TagProPCAModel.js';

let model = new TagProPCAModel();

Comlink.expose(model);