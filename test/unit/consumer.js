const Chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const Sinon = require('sinon');
const SinonChai = require('sinon-chai');

Chai.use(chaiAsPromised);
Chai.use(SinonChai);
const { expect } = Chai;

const exampleImaging = require('../data/imaging');
const { getMessage } = require('../utils/mq');
const { readKey, setKey } = require('../utils/redis');

describe('Consumer', () => {
  before(() => {
    this.exampleImaging = exampleImaging;
    this.exampleImagingId = exampleImaging._id;
    this.badImaging = { _id: 'partial' };
    this.diagnosis = 'diagnosis';

    this.mq = global.consumerInstance.mq;
    this.diagnosesService = this.mq.diagnosesService;

    this.channel = this.mq.channel;
    this.redis = this.diagnosesService.redis;
  });

  beforeEach(() => {
    this.diagnosesServiceSpy = Sinon.spy(this.diagnosesService, 'update');
    this.redisSremSpy = Sinon.spy(this.redis, 'remMembers');
    this.redisSgetSpy = Sinon.spy(this.redis, 'getMembers');

    this.publishStub = Sinon.stub(this.channel, 'publish');
    this.ackStub = Sinon.stub(this.channel, 'ack');
    this.rejectStub = Sinon.stub(this.channel, 'reject');
  });

  afterEach(() => {
    this.diagnosesServiceSpy.restore();
    this.redisSremSpy.restore();
    this.redisSgetSpy.restore();

    this.publishStub.restore();
    this.ackStub.restore();
    this.rejectStub.restore();
  });

  describe('Diagnoses Service', () => {
    describe('#update', () => {
      it('should update redis key for existing diagnosis', async () => {
        await setKey(this.exampleImagingId, ['fake', this.diagnosis]);

        await this.diagnosesService.update(this.exampleImagingId, this.diagnosis);
        // eslint-disable-next-line max-len
        expect(this.redisSremSpy).to.have.been.calledOnceWithExactly(this.exampleImagingId, this.diagnosis);
        expect(this.redisSgetSpy).to.have.been.calledOnceWithExactly(this.exampleImagingId);

        const redisDiagnoses = await readKey(this.exampleImagingId);
        expect(redisDiagnoses).to.eql(['fake']);
      });

      it('should not update redis key for non-existing this.diagnosis', async () => {
        await setKey(this.exampleImagingId, ['fake']);

        await this.diagnosesService.update(this.exampleImagingId, this.diagnosis);
        // eslint-disable-next-line max-len
        expect(this.redisSremSpy).to.have.been.calledOnceWithExactly(this.exampleImagingId, this.diagnosis);
        expect(this.redisSgetSpy).to.have.been.calledOnceWithExactly(this.exampleImagingId);

        const redisDiagnoses = await readKey(this.exampleImagingId);
        expect(redisDiagnoses).to.eql(['fake']);
      });

      it('should fail update when redis rem members throws', async () => {
        this.redisSremSpy.restore();
        const redisSremStub = Sinon.stub(this.redis, 'remMembers').throws();

        // eslint-disable-next-line max-len
        await expect(this.diagnosesService.update(this.exampleImagingId, this.diagnosis)).to.be.rejected;
        redisSremStub.restore();
      });

      it('should fail update when redis get members throws', async () => {
        this.redisSgetSpy.restore();
        const redisSgetStub = Sinon.stub(this.redis, 'getMembers').throws();

        // eslint-disable-next-line max-len
        await expect(this.diagnosesService.update(this.exampleImagingId, this.diagnosis)).to.be.rejected;
        redisSgetStub.restore();
      });
    });
  });

  describe('Message Handler', () => {
    it('should pop redis member, publish discharge and ack when set was empty', async () => {
      const msg = getMessage(this.exampleImaging, this.diagnosis);
      await this.mq._msgHandler(msg);

      // eslint-disable-next-line max-len
      expect(this.diagnosesServiceSpy).to.have.been.calledOnceWith(this.exampleImagingId, this.diagnosis);
      expect(this.redisSremSpy).to.have.been.calledOnceWith(this.exampleImagingId, this.diagnosis);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      // eslint-disable-next-line max-len
      expect(this.publishStub).to.have.been.calledOnceWith(Sinon.match.any, Sinon.match.any, Buffer.from(JSON.stringify(this.exampleImagingId)), Sinon.match.any);
      expect(this.ackStub).to.have.been.calledOnceWithExactly(msg);
      // eslint-disable-next-line no-unused-expressions
      expect(this.rejectStub).to.have.not.been.called;
    });

    it('should pop redis member, publish discharge and ack when set becomes empty', async () => {
      this.redis.setMembers(this.exampleImagingId, this.diagnosis);

      const msg = getMessage(this.exampleImaging, this.diagnosis);
      await this.mq._msgHandler(msg);

      // eslint-disable-next-line max-len
      expect(this.diagnosesServiceSpy).to.have.been.calledOnceWith(this.exampleImagingId, this.diagnosis);
      expect(this.redisSremSpy).to.have.been.calledOnceWith(this.exampleImagingId, this.diagnosis);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      // eslint-disable-next-line max-len
      expect(this.publishStub).to.have.been.calledOnceWith(Sinon.match.any, Sinon.match.any, Buffer.from(JSON.stringify(this.exampleImagingId)), Sinon.match.any);
      expect(this.ackStub).to.have.been.calledOnceWithExactly(msg);
      // eslint-disable-next-line no-unused-expressions
      expect(this.rejectStub).to.have.not.been.called;
    });

    it('should pop redis member and ack but not publish discharge when set is not empty', async () => {
      this.redis.setMembers(this.exampleImagingId, [this.diagnosis, 'fakeDiagnosis']);

      const msg = getMessage(this.exampleImaging, this.diagnosis);
      await this.mq._msgHandler(msg);

      // eslint-disable-next-line max-len
      expect(this.diagnosesServiceSpy).to.have.been.calledOnceWith(this.exampleImagingId, this.diagnosis);
      expect(this.redisSremSpy).to.have.been.calledOnceWith(this.exampleImagingId, this.diagnosis);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      // eslint-disable-next-line no-unused-expressions
      expect(this.publishStub).to.have.not.been.called;
      expect(this.ackStub).to.have.been.calledOnceWithExactly(msg);
      // eslint-disable-next-line no-unused-expressions
      expect(this.rejectStub).to.have.not.been.called;
    });

    it('should reject with no requeue when given improper message', async () => {
      const msg = getMessage(this.badImaging, this.diagnosis);
      await this.mq._msgHandler(msg);

      // eslint-disable-next-line no-unused-expressions
      expect(this.diagnosesServiceSpy).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.redisSremSpy).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.redisSgetSpy).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.publishStub).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.ackStub).to.have.not.been.called;
      expect(this.rejectStub).to.have.been.calledOnceWithExactly(msg, false);
    });

    it('should reject with requeue proper message when fails to remove redis set member', async () => {
      this.redisSremSpy.restore();
      this.redisSremSpy = Sinon.stub(this.redis, 'remMembers').throws();

      const msg = getMessage(this.exampleImaging, this.diagnosis);
      await this.mq._msgHandler(msg);

      // eslint-disable-next-line max-len
      expect(this.diagnosesServiceSpy).to.have.been.calledOnceWith(this.exampleImagingId, this.diagnosis);
      expect(this.redisSremSpy).to.have.been.calledOnceWith(this.exampleImagingId, this.diagnosis);
      // eslint-disable-next-line no-unused-expressions
      expect(this.redisSgetSpy).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.publishStub).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.ackStub).to.have.not.been.called;
      expect(this.rejectStub).to.have.been.calledOnceWithExactly(msg, true);
    });

    it('should reject with requeue proper message when fails to read redis key', async () => {
      this.redisSgetSpy.restore();
      this.redisSgetSpy = Sinon.stub(this.redis, 'getMembers').throws();

      const msg = getMessage(this.exampleImaging, this.diagnosis);
      await this.mq._msgHandler(msg);

      // eslint-disable-next-line max-len
      expect(this.diagnosesServiceSpy).to.have.been.calledOnceWith(this.exampleImagingId, this.diagnosis);
      expect(this.redisSremSpy).to.have.been.calledOnceWith(this.exampleImagingId, this.diagnosis);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      // eslint-disable-next-line no-unused-expressions
      expect(this.publishStub).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.ackStub).to.have.not.been.called;
      expect(this.rejectStub).to.have.been.calledOnceWithExactly(msg, true);
    });

    it('should reject with requeue proper message when fails to publish discharge', async () => {
      this.publishStub.restore();
      this.publishStub = Sinon.stub(this.channel, 'publish').throws();

      const msg = getMessage(this.exampleImaging, this.diagnosis);
      await this.mq._msgHandler(msg);

      // eslint-disable-next-line max-len
      expect(this.diagnosesServiceSpy).to.have.been.calledOnceWith(this.exampleImagingId, this.diagnosis);
      expect(this.redisSremSpy).to.have.been.calledOnceWith(this.exampleImagingId, this.diagnosis);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      // eslint-disable-next-line max-len
      expect(this.publishStub).to.have.been.calledOnceWith(Sinon.match.any, Sinon.match.any, Buffer.from(JSON.stringify(this.exampleImagingId)), Sinon.match.any);
      // eslint-disable-next-line no-unused-expressions
      expect(this.ackStub).to.have.not.been.called;
      expect(this.rejectStub).to.have.been.calledOnceWithExactly(msg, true);
    });
  });
});
