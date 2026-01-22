import { User } from '../../../models/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const fetchLogs = async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.user.id, {
      include: ['current_role']
    });

    if (!loggedInUser || loggedInUser.current_role?.role !== 'admin') {
      return res.status(403).json({
        message: 'You do not have permission to view logs'
      });
    }

    // TODO: Update log file path based on your logging configuration
    const filePath = path.join(__dirname, '../../../storage/logs/application.log');
    const offset = parseInt(req.query.offset) || 0;
    const direction = req.query.direction || 'forward';

    if (!fs.existsSync(filePath)) {
      return res.status(200).json({
        logs: '',
        offset: 0,
        size: 0
      });
    }

    const stats = fs.statSync(filePath);
    const size = stats.size;
    const chunkSize = 5000; // arbitrary chunk size
    const validOffset = Math.max(0, Math.min(offset, size));

    const fd = fs.openSync(filePath, 'r');

    try {
      if (direction === 'backward') {
        // Read previous chunk
        const readStart = Math.max(0, validOffset - chunkSize);
        const readLength = validOffset - readStart;

        if (readLength <= 0) {
          fs.closeSync(fd);
          return res.status(200).json({
            logs: '',
            offset: 0,
            size: size
          });
        }

        const buffer = Buffer.alloc(readLength);
        fs.readSync(fd, buffer, 0, readLength, readStart);
        const logs = buffer.toString('utf8');

        fs.closeSync(fd);

        return res.status(200).json({
          logs: logs,
          offset: readStart,
          size: size
        });
      } else {
        // Read next chunk
        const readLength = Math.min(chunkSize, size - validOffset);

        if (readLength <= 0) {
          fs.closeSync(fd);
          return res.status(200).json({
            logs: '',
            offset: validOffset,
            size: size
          });
        }

        const buffer = Buffer.alloc(readLength);
        fs.readSync(fd, buffer, 0, readLength, validOffset);
        const logs = buffer.toString('utf8');

        fs.closeSync(fd);

        return res.status(200).json({
          logs: logs,
          offset: validOffset + readLength,
          size: size
        });
      }
    } catch (readError) {
      fs.closeSync(fd);
      throw readError;
    }
  } catch (error) {
    console.error('Error fetching logs:', error);
    return res.status(500).json({
      message: 'Failed to fetch logs',
      error: error.message
    });
  }
};
