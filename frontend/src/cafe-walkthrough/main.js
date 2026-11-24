import { mountCafeWalkthrough } from './walkthrough.js';
import './walkthrough.css';

const container = document.querySelector('#walkthrough');
if (container) mountCafeWalkthrough(container);
