const Chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const Sinon = require('sinon');
const SinonChai = require('sinon-chai');

Chai.use(chaiAsPromised);
Chai.use(SinonChai);
const { expect } = Chai;

const { getMessage } = require('../utils/mq');

describe('Consumer', () => {
  before(() => {
    this.exampleImagingId = 'imagingId';

    this.mq = global.consumerInstance.mq;
    this.diagnosesService = this.mq.diagnosesService;

    this.channel = this.mq.channel;
    this.redis = this.diagnosesService.redis;
  });

  beforeEach(() => {
    this.diagnosesServiceGetSpy = Sinon.spy(this.diagnosesService, 'get');
    this.diagnosesServiceEmptySpy = Sinon.spy(this.diagnosesService, 'empty');
    this.redisSgetSpy = Sinon.spy(this.redis, 'getMembers');
    this.redisSdelSpy = Sinon.spy(this.redis, 'delMembers');

    this.publishStub = Sinon.stub(this.channel, 'publish');
    this.ackStub = Sinon.stub(this.channel, 'ack');
    this.rejectStub = Sinon.stub(this.channel, 'reject');
  });

  afterEach(() => {
    this.diagnosesServiceGetSpy.restore();
    this.diagnosesServiceEmptySpy.restore();
    this.redisSgetSpy.restore();
    this.redisSdelSpy.restore();

    this.publishStub.restore();
    this.ackStub.restore();
    this.rejectStub.restore();
  });

  describe('Message Handler', () => {
    it('should not publish discharge but ack when set is empty', async () => {
      const msg = getMessage(this.exampleImagingId);
      await this.mq._msgHandler(msg);

      expect(this.diagnosesServiceGetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      // eslint-disable-next-line no-unused-expressions
      expect(this.publishStub).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.diagnosesServiceEmptySpy).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.redisSdelSpy).to.have.not.been.called;
      expect(this.ackStub).to.have.been.calledOnceWithExactly(msg);
      // eslint-disable-next-line no-unused-expressions
      expect(this.rejectStub).to.have.not.been.called;
    });

    it('should publish discharge and ack when set is not empty', async () => {
      await this.redis.setMembers(this.exampleImagingId, ['fakeDiagnosis1', 'fakeDiagnosis2']);

      const msg = getMessage(this.exampleImagingId);
      await this.mq._msgHandler(msg);

      expect(this.diagnosesServiceGetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      // eslint-disable-next-line max-len
      expect(this.publishStub).to.have.been.calledOnceWith(Sinon.match.any, Sinon.match.any, Buffer.from(JSON.stringify(this.exampleImagingId)), Sinon.match.any);
      expect(this.diagnosesServiceEmptySpy).to.have.been.calledOnceWith(this.exampleImagingId);
      expect(this.redisSdelSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      expect(this.ackStub).to.have.been.calledOnceWithExactly(msg);
      // eslint-disable-next-line no-unused-expressions
      expect(this.rejectStub).to.have.not.been.called;
    });

    it('should reject with requeue proper message when fails to read redis key', async () => {
      this.redisSgetSpy.restore();
      this.redisSgetSpy = Sinon.stub(this.redis, 'getMembers').throws();

      const msg = getMessage(this.exampleImagingId);
      await this.mq._msgHandler(msg);

      expect(this.diagnosesServiceGetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      // eslint-disable-next-line no-unused-expressions
      expect(this.publishStub).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.diagnosesServiceEmptySpy).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.redisSdelSpy).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.ackStub).to.have.not.been.called;
      expect(this.rejectStub).to.have.been.calledOnceWithExactly(msg, true);
    });

    it('should reject with requeue proper message when fails to publish discharge', async () => {
      await this.redis.setMembers(this.exampleImagingId, ['fakeDiagnosis1', 'fakeDiagnosis2']);

      this.publishStub.restore();
      this.publishStub = Sinon.stub(this.channel, 'publish').throws();

      const msg = getMessage(this.exampleImagingId);
      await this.mq._msgHandler(msg);

      expect(this.diagnosesServiceGetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      // eslint-disable-next-line max-len
      expect(this.publishStub).to.have.been.calledOnceWith(Sinon.match.any, Sinon.match.any, Buffer.from(JSON.stringify(this.exampleImagingId)), Sinon.match.any);
      // eslint-disable-next-line no-unused-expressions
      expect(this.diagnosesServiceEmptySpy).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.redisSdelSpy).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.ackStub).to.have.not.been.called;
      expect(this.rejectStub).to.have.been.calledOnceWithExactly(msg, true);
    });

    it('should ack when fails to empty redis key', async () => {
      await this.redis.setMembers(this.exampleImagingId, ['fakeDiagnosis1', 'fakeDiagnosis2']);

      this.redisSdelSpy.restore();
      this.redisSdelSpy = Sinon.stub(this.redis, 'delMembers').throws();

      const msg = getMessage(this.exampleImagingId);
      await this.mq._msgHandler(msg);

      expect(this.diagnosesServiceGetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      // eslint-disable-next-line max-len
      expect(this.publishStub).to.have.been.calledOnceWith(Sinon.match.any, Sinon.match.any, Buffer.from(JSON.stringify(this.exampleImagingId)), Sinon.match.any);
      expect(this.diagnosesServiceEmptySpy).to.have.been.calledOnceWith(this.exampleImagingId);
      expect(this.redisSdelSpy).to.have.been.calledOnceWith(this.exampleImagingId);
      expect(this.ackStub).to.have.been.calledOnceWithExactly(msg);
      // eslint-disable-next-line no-unused-expressions
      expect(this.rejectStub).to.have.not.been.called;
    });
  });
});
