import 'dotenv/config';
import { app } from './app.js';
import './db/database.js';
const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`FinPay API running at http://localhost:${port}`));
