import express from 'express';
import routes from './routes';
import bodyParser from 'body-parser';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());

app.use('/', routes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
